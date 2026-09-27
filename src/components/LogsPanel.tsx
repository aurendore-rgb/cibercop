import React, { useEffect, useState } from 'react';
import {
  Terminal,
  RotateCw,
  Trash2,
  Filter,
} from 'lucide-react';
import { LogEntryClient } from '../types/gateway';

export const LogsPanel: React.FC = () => {
  const [logs, setLogs] = useState<LogEntryClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['ALL', 'Gateway', 'HTTP', 'AUTH', 'ONVIF', 'CAMERA', 'RTSP', 'MEDIA'];

  const fetchLogs = async () => {
    try {
      const url = selectedCategory === 'ALL'
        ? '/api/logs?limit=150'
        : `/api/logs?category=${selectedCategory}&limit=150`;
      const res = await fetch(url);
      const json = await res.json();
      setLogs(json);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedCategory]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 2500);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedCategory]);

  const filteredLogs = logs.filter(l => {
    if (!searchQuery) return true;
    return l.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.category.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Gateway': return 'text-cyan-400 bg-cyan-950/60 border-cyan-800';
      case 'HTTP': return 'text-sky-400 bg-sky-950/60 border-sky-800';
      case 'AUTH': return 'text-purple-400 bg-purple-950/60 border-purple-800';
      case 'ONVIF': return 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
      case 'CAMERA': return 'text-amber-400 bg-amber-950/60 border-amber-800';
      case 'RTSP': return 'text-indigo-400 bg-indigo-950/60 border-indigo-800';
      case 'MEDIA': return 'text-rose-400 bg-rose-950/60 border-rose-800';
      default: return 'text-slate-400 bg-slate-900 border-slate-700';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4">
      {/* Top Header & Category Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Logs de Operação do Gateway
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Eventos reais com sanitização de segurança (senhas e tokens nunca são registrados)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>Auto Atualizar (2.5s)</span>
            </label>

            <button
              onClick={fetchLogs}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
              title="Atualizar agora"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 text-xs font-mono font-medium rounded transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {cat === 'ALL' ? 'TODOS OS LOGS' : `[${cat}]`}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar mensagens..."
            className="bg-slate-950 border border-slate-800 text-white text-xs px-3 py-1.5 rounded outline-none focus:border-cyan-500 font-mono w-full sm:w-56"
          />
        </div>
      </div>

      {/* Log Console Terminal View */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-slate-500 text-[11px]">
          <span>CONVENCIONAL LOG STREAM (LATEST FIRST)</span>
          <span>{filteredLogs.length} entradas</span>
        </div>

        <div className="divide-y divide-slate-900 max-h-[550px] overflow-y-auto space-y-1 pt-2 font-mono text-[11px]">
          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-600">
              Nenhum evento registrado nesta categoria.
            </div>
          ) : (
            filteredLogs.map((entry) => (
              <div key={entry.id} className="py-1.5 flex items-start gap-2.5 leading-relaxed hover:bg-slate-900/40 px-1 rounded">
                <span className="text-slate-500 shrink-0 tabular-nums">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>

                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${getCategoryColor(
                    entry.category
                  )}`}
                >
                  [{entry.category}]
                </span>

                <span
                  className={`break-all ${
                    entry.level === 'error'
                      ? 'text-rose-400 font-bold'
                      : entry.level === 'warn'
                      ? 'text-amber-400'
                      : 'text-slate-300'
                  }`}
                >
                  {entry.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
