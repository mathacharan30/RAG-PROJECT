import { useEffect, useState } from 'react';
import { MessageSquare, FolderOpen, Zap, Database } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function Sidebar({ activeTab, setActiveTab }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`${API}/stats`)
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const nav = [
    { id: 'chat',   label: 'Chat',      Icon: MessageSquare, desc: 'Ask your documents' },
    { id: 'upload', label: 'Documents', Icon: FolderOpen,    desc: 'Upload & manage' },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800/80 flex flex-col">
      {/* Brand */}
      <div className="p-5 border-b border-gray-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-900/30">
            <Zap className="w-4.5 h-4.5 text-white" size={18} />
          </div>
          <div>
            <h1 className="font-semibold text-white text-[15px] leading-none tracking-tight">
              RAG Studio
            </h1>
            <p className="text-[11px] text-gray-500 mt-1 leading-none">Qdrant · Gemini · HF</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ id, label, Icon, desc }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all group ${
              activeTab === id
                ? 'bg-violet-600/15 border border-violet-500/25 text-violet-300'
                : 'text-gray-400 hover:bg-gray-800/70 hover:text-gray-200 border border-transparent'
            }`}
          >
            <Icon
              size={16}
              className={activeTab === id ? 'text-violet-400' : 'text-gray-500 group-hover:text-gray-300'}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-none">{label}</p>
              <p className={`text-[11px] mt-1 leading-none ${activeTab === id ? 'text-violet-400/70' : 'text-gray-600'}`}>
                {desc}
              </p>
            </div>
          </button>
        ))}
      </nav>

      {/* DB Status */}
      <div className="p-3 border-t border-gray-800/80">
        <div className="px-3 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Database size={13} className="text-gray-500" />
            <span className="text-xs text-gray-500 font-medium">Qdrant Cloud</span>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400">live</span>
            </div>
          </div>
          {stats !== null ? (
            <p className="text-xs text-gray-300">
              <span className="font-semibold text-violet-400">{stats.points ?? 0}</span>{' '}
              <span className="text-gray-500">vectors stored</span>
            </p>
          ) : (
            <div className="h-4 w-24 rounded shimmer" />
          )}
        </div>
      </div>
    </aside>
  );
}
