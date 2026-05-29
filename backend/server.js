require('dotenv').config();

const REQUIRED_ENV = ['GROQ_API_KEY', 'HUGGINGFACE_API_KEY', 'QDRANT_URL', 'QDRANT_API_KEY'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error('❌ Missing required environment variables:', missing.join(', '));
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { randomUUID } = require('crypto');
const Groq = require('groq-sdk');
const { QdrantClient } = require('@qdrant/js-client-rest');
const { HfInference } = require('@huggingface/inference');

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

/* ── CLIENTS ─────────────────────────────────────────────── */
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION = 'rag_documents';
const VECTOR_DIM = 384;

/* ── QDRANT INIT ─────────────────────────────────────────── */
async function ensureCollection() {
  const exists = await qdrant
    .getCollections()
    .then(r => r.collections.some(c => c.name === COLLECTION))
    .catch(() => false);

  if (!exists) {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: VECTOR_DIM, distance: 'Cosine' },
    });
    console.log(`Created Qdrant collection: ${COLLECTION}`);
  }
}

/* ── HELPERS ─────────────────────────────────────────────── */
async function embedText(text) {
  const embedding = await hf.featureExtraction({
    model: 'sentence-transformers/all-MiniLM-L6-v2',
    inputs: text,
  });
  if (!Array.isArray(embedding)) throw new Error('Invalid embedding from HuggingFace');
  return embedding;
}

function chunkText(text, size = 400, overlap = 50) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    const chunk = words.slice(i, i + size).join(' ');
    if (chunk.trim().length > 30) chunks.push(chunk);
  }
  return chunks;
}

async function upsertChunk({ title, text, metadata }) {
  const vector = await embedText(text);
  await qdrant.upsert(COLLECTION, {
    wait: true,
    points: [{
      id: randomUUID(),
      vector,
      payload: { title: title || null, content: text, metadata: metadata || {} },
    }],
  });
}

async function vectorSearch(embedding, limit = 6, threshold = 0.3) {
  const hits = await qdrant.search(COLLECTION, {
    vector: embedding,
    limit,
    score_threshold: threshold,
    with_payload: true,
  });
  return hits.map(h => ({
    id: h.id,
    title: h.payload.title,
    content: h.payload.content,
    metadata: h.payload.metadata,
    similarity: h.score,
  }));
}

async function keywordSearch(question, limit = 6) {
  const STOP = new Set([
    'what','which','where','when','why','how','show','find','from','that',
    'this','have','will','would','could','should','please','list','records',
    'data','give','some','any','all','for','and','the','are','with','into',
  ]);

  const terms = (question.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter(w => w.length >= 4 && !STOP.has(w));

  if (!terms.length) return [];

  const { points = [] } = await qdrant.scroll(COLLECTION, {
    limit: 300,
    with_payload: true,
    with_vector: false,
  });

  return points
    .filter(p => {
      const c = (p.payload?.content || '').toLowerCase();
      return terms.some(t => c.includes(t));
    })
    .slice(0, limit)
    .map(p => ({
      id: p.id,
      title: p.payload.title,
      content: p.payload.content,
      metadata: p.payload.metadata,
      similarity: 0.5,
    }));
}

async function generateAnswer(question, contexts) {
  const block = contexts.length
    ? contexts
        .map((c, i) => `[${i + 1}] (score: ${c.similarity.toFixed(2)})\n${c.content}`)
        .join('\n\n')
    : 'No relevant context found.';

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant. Answer using only the provided context. If context is empty or irrelevant, say "I do not have information on that."',
      },
      {
        role: 'user',
        content: `Context:\n${block}\n\nQuestion: ${question}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1024,
  });

  return completion.choices[0].message.content;
}

/* ── ROUTES ──────────────────────────────────────────────── */
app.get('/', (_req, res) => res.json({ status: 'RAG running', llm: 'Groq / Llama-3.3-70B', db: 'Qdrant Cloud' }));

// Ingest plain text
app.post('/ingest', async (req, res) => {
  const { title, text, metadata } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

  try {
    const chunks = chunkText(text);
    for (let i = 0; i < chunks.length; i++) {
      await upsertChunk({ title, text: chunks[i], metadata: { ...metadata, chunk_index: i } });
    }
    res.json({ success: true, chunks: chunks.length });
  } catch (e) {
    console.error('Ingest error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Upload file (PDF, TXT, MD, CSV)
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const ext = req.file.originalname.split('.').pop().toLowerCase();
  let text = '';

  try {
    if (ext === 'pdf') {
      const pdfParse = require('pdf-parse');
      const parsed = await pdfParse(req.file.buffer);
      text = parsed.text;
    } else if (['txt', 'md', 'csv'].includes(ext)) {
      text = req.file.buffer.toString('utf-8');
    } else {
      return res.status(400).json({ error: 'Supported formats: PDF, TXT, MD, CSV' });
    }

    if (!text.trim()) return res.status(400).json({ error: 'No text extracted from file' });

    const title = req.file.originalname;
    const chunks = chunkText(text);
    for (let i = 0; i < chunks.length; i++) {
      await upsertChunk({ title, text: chunks[i], metadata: { source: title, chunk_index: i } });
    }
    res.json({ success: true, filename: title, chunks: chunks.length });
  } catch (e) {
    console.error('Upload error:', e);
    res.status(500).json({ error: e.message });
  }
});

// List documents in Qdrant
app.get('/documents', async (_req, res) => {
  try {
    const { points = [] } = await qdrant.scroll(COLLECTION, {
      limit: 1000,
      with_payload: true,
      with_vector: false,
    });

    const map = {};
    for (const p of points) {
      const key = p.payload?.metadata?.source || p.payload?.title || 'Untitled';
      map[key] = (map[key] || 0) + 1;
    }
    res.json({
      documents: Object.entries(map).map(([name, chunks]) => ({ name, chunks })),
      total_chunks: points.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete all documents
app.delete('/documents', async (_req, res) => {
  try {
    await qdrant.deleteCollection(COLLECTION);
    await ensureCollection();
    res.json({ success: true, message: 'All documents cleared' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Chat
app.post('/chat', async (req, res) => {
  const { message, matchCount, similarityThreshold } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  try {
    const vec = await embedText(message);
    let contexts = await vectorSearch(vec, Number(matchCount) || 6, similarityThreshold ?? 0.3);
    if (!contexts.length) contexts = await keywordSearch(message, Number(matchCount) || 6);

    const answer = await generateAnswer(message, contexts);
    res.json({ answer, contexts });
  } catch (e) {
    console.error('Chat error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Stats
app.get('/stats', async (_req, res) => {
  try {
    const info = await qdrant.getCollection(COLLECTION);
    res.json({ points: info.points_count, status: info.status, collection: COLLECTION });
  } catch {
    res.json({ points: 0, status: 'empty', collection: COLLECTION });
  }
});

/* ── START ───────────────────────────────────────────────── */
const PORT = process.env.PORT || 8080;
(async () => {
  await ensureCollection();
  app.listen(PORT, () => console.log(`Server → http://localhost:${PORT}`));
})();
