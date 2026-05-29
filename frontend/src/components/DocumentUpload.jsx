import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, FileText, Trash2, CheckCircle2, XCircle,
  Loader2, File, FolderOpen, Type, Database,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function StatusBanner({ status }) {
  if (!status) return null;
  const ok = status.type === 'success';
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm msg-enter ${
      ok
        ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
        : 'bg-red-950/40 border-red-800/50 text-red-300'
    }`}>
      {ok
        ? <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
        : <XCircle size={16} className="flex-shrink-0 mt-0.5" />
      }
      <span>{status.message}</span>
    </div>
  );
}

export default function DocumentUpload() {
  const [tab, setTab] = useState('file');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null);
  const [textTitle, setTextTitle] = useState('');
  const [textBody, setTextBody] = useState('');
  const [docs, setDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const fileRef = useRef(null);

  const loadDocs = async () => {
    try {
      const res = await fetch(`${API}/documents`);
      const data = await res.json();
      setDocs(data.documents || []);
    } catch {
      setDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => { loadDocs(); }, []);

  const showStatus = (type, message) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 5000);
  };

  const uploadFile = async (file) => {
    setUploading(true);
    setStatus(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/upload`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        showStatus('success', `"${data.filename}" uploaded — ${data.chunks} chunks indexed`);
        loadDocs();
      } else {
        showStatus('error', data.error || 'Upload failed');
      }
    } catch {
      showStatus('error', 'Could not reach the server');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const uploadText = async () => {
    if (!textBody.trim()) return;
    setUploading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: textTitle.trim() || 'Manual Entry', text: textBody }),
      });
      const data = await res.json();
      if (data.success) {
        showStatus('success', `Text ingested — ${data.chunks} chunks indexed`);
        setTextTitle('');
        setTextBody('');
        loadDocs();
      } else {
        showStatus('error', data.error || 'Ingest failed');
      }
    } catch {
      showStatus('error', 'Could not reach the server');
    } finally {
      setUploading(false);
    }
  };

  const deleteAll = async () => {
    if (!window.confirm('Delete ALL documents from Qdrant? This cannot be undone.')) return;
    try {
      await fetch(`${API}/documents`, { method: 'DELETE' });
      setDocs([]);
      showStatus('success', 'All documents cleared from Qdrant');
    } catch {
      showStatus('error', 'Delete failed');
    }
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }, []);

  const totalChunks = docs.reduce((s, d) => s + d.chunks, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-800/80 bg-gray-950/60 backdrop-blur-sm flex-shrink-0">
        <h2 className="text-[15px] font-semibold text-white">Document Manager</h2>
        <p className="text-xs text-gray-500 mt-0.5">Upload files or paste text to build your knowledge base</p>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-5">

          {/* DB summary */}
          {!loadingDocs && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900 border border-gray-800">
              <div className="w-8 h-8 rounded-lg bg-violet-900/30 border border-violet-700/30 flex items-center justify-center">
                <Database size={14} className="text-violet-400" />
              </div>
              <div>
                <p className="text-sm text-gray-200 font-medium">
                  {docs.length === 0 ? 'Knowledge base is empty' : `${docs.length} document${docs.length !== 1 ? 's' : ''} indexed`}
                </p>
                {totalChunks > 0 && (
                  <p className="text-xs text-gray-500">{totalChunks} total chunks in Qdrant</p>
                )}
              </div>
            </div>
          )}

          {/* Tab Toggle */}
          <div className="flex p-1 bg-gray-900 rounded-xl border border-gray-800">
            {[
              { id: 'file', label: 'Upload File',  Icon: Upload },
              { id: 'text', label: 'Paste Text',   Icon: Type   },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  tab === id
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* File Upload Zone */}
          {tab === 'file' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => !uploading && fileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all select-none ${
                dragging
                  ? 'border-violet-500 bg-violet-600/8 scale-[1.01]'
                  : uploading
                  ? 'border-gray-700 bg-gray-900/40 cursor-default'
                  : 'border-gray-700 bg-gray-900/30 hover:border-violet-500/60 hover:bg-gray-900/60'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.md,.csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={36} className="text-violet-500 animate-spin" />
                  <div>
                    <p className="text-gray-200 font-medium">Processing document…</p>
                    <p className="text-xs text-gray-500 mt-1">Generating embeddings and storing in Qdrant</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mx-auto mb-4">
                    <Upload size={22} className="text-gray-400" />
                  </div>
                  <p className="text-gray-200 font-medium">Drop your file here</p>
                  <p className="text-gray-500 text-sm mt-1">or click to browse</p>
                  <div className="flex gap-2 justify-center mt-5">
                    {['PDF', 'TXT', 'MD', 'CSV'].map(t => (
                      <span
                        key={t}
                        className="px-2.5 py-1 text-xs font-medium bg-gray-800 text-gray-400 rounded-lg border border-gray-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-4">Max 20 MB</p>
                </>
              )}
            </div>
          )}

          {/* Text Paste */}
          {tab === 'text' && (
            <div className="space-y-3">
              <input
                type="text"
                value={textTitle}
                onChange={e => setTextTitle(e.target.value)}
                placeholder="Document title (optional)"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
              />
              <textarea
                value={textBody}
                onChange={e => setTextBody(e.target.value)}
                placeholder="Paste your document content here…"
                rows={9}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all resize-none"
              />
              {textBody.trim() && (
                <p className="text-xs text-gray-600">
                  ~{Math.ceil(textBody.split(/\s+/).length / 350)} chunks will be created
                </p>
              )}
              <button
                onClick={uploadText}
                disabled={!textBody.trim() || uploading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-medium hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-violet-900/25"
              >
                {uploading && <Loader2 size={15} className="animate-spin" />}
                {uploading ? 'Indexing…' : 'Ingest Text'}
              </button>
            </div>
          )}

          {/* Status Banner */}
          <StatusBanner status={status} />

          {/* Document List */}
          {loadingDocs ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl shimmer" />
              ))}
            </div>
          ) : docs.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <FolderOpen size={14} className="text-gray-500" />
                  Knowledge Base
                </h3>
                <button
                  onClick={deleteAll}
                  className="flex items-center gap-1.5 text-xs text-red-500/80 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-950/30"
                >
                  <Trash2 size={12} />
                  Clear All
                </button>
              </div>
              <div className="space-y-2">
                {docs.map((doc, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3.5 bg-gray-900 border border-gray-800/80 rounded-xl hover:border-gray-700 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-900/25 border border-violet-800/30 flex items-center justify-center flex-shrink-0">
                      <FileText size={14} className="text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate font-medium">{doc.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{doc.chunks} chunk{doc.chunks !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-800/40 flex-shrink-0">
                      indexed
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-gray-600">
              <File size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No documents yet. Upload something to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
