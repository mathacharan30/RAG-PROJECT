import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, User, ChevronDown, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API = 'http://localhost:8080';

const SUGGESTIONS = [
  'Summarize the key topics in the knowledge base',
  'What information is available about this subject?',
  'List the main points from the uploaded documents',
  'What are the most important details you found?',
];

function TypingDots() {
  return (
    <div className="flex gap-1.5 items-center py-1">
      {[0, 150, 300].map(delay => (
        <span
          key={delay}
          className="w-2 h-2 rounded-full bg-violet-400 animate-bounce"
          style={{ animationDelay: `${delay}ms`, animationDuration: '0.9s' }}
        />
      ))}
    </div>
  );
}

function SourcePills({ contexts }) {
  const [open, setOpen] = useState(false);
  if (!contexts?.length) return null;
  return (
    <div className="mt-3 pt-3 border-t border-gray-700/60">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-400 transition-colors"
      >
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        {contexts.length} source{contexts.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {contexts.map((c, i) => (
            <span
              key={i}
              title={c.content?.slice(0, 120)}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-gray-800 text-gray-400 border border-gray-700/50 max-w-[200px] truncate"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
              {(c.title || 'Document').slice(0, 28)}
              <span className="ml-auto text-gray-600 flex-shrink-0">{(c.similarity * 100).toFixed(0)}%</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  };

  const send = useCallback(async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer || data.error || 'No response.',
          contexts: data.contexts,
        },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Could not reach the server. Make sure the backend is running.' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const clear = () => setMessages([]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800/80 bg-gray-950/60 backdrop-blur-sm flex-shrink-0">
        <div>
          <h2 className="text-[15px] font-semibold text-white">Chat</h2>
          <p className="text-xs text-gray-500 mt-0.5">Retrieval-augmented answers from your documents</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clear}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
          >
            <RotateCcw size={12} />
            Clear
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-5 px-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center shadow-2xl shadow-violet-900/40">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-2 border-gray-950 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-white">RAG Assistant</h3>
              <p className="text-gray-400 text-sm mt-1.5 max-w-xs leading-relaxed">
                Upload documents first, then ask questions — I'll find and synthesize the answers.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-sm mt-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  className="text-left px-4 py-3 rounded-xl border border-gray-800 bg-gray-900/60 text-sm text-gray-300 hover:border-violet-500/40 hover:bg-gray-900 hover:text-white transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`msg-enter flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-violet-900/30">
                    <Sparkles size={14} className="text-white" />
                  </div>
                )}

                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-violet-600 to-violet-700 text-white rounded-tr-sm shadow-lg shadow-violet-900/25'
                      : 'bg-gray-900 border border-gray-800/80 text-gray-100 rounded-tl-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <>
                      <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:text-gray-100 prose-code:text-violet-300 prose-code:bg-gray-800 prose-code:px-1 prose-code:rounded">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      <SourcePills contexts={msg.contexts} />
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User size={14} className="text-gray-400" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="msg-enter flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div className="bg-gray-900 border border-gray-800/80 rounded-2xl rounded-tl-sm px-4 py-3">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-gray-800/80 bg-gray-950/60">
        <div className="flex gap-3 items-end max-w-3xl mx-auto">
          <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/20 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize(); }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask about your documents…"
              rows={1}
              className="w-full bg-transparent px-4 py-3 text-sm text-gray-100 placeholder-gray-600 resize-none focus:outline-none leading-relaxed"
            />
          </div>
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-10 h-10 flex-shrink-0 rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-violet-900/30"
          >
            <Send size={15} className="text-white translate-x-px" />
          </button>
        </div>
        <p className="text-center text-[11px] text-gray-700 mt-2">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
