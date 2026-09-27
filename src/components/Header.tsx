import React from 'react';
import { ShieldCheck, Copy, Check, Download } from 'lucide-react';

interface HeaderProps {
  activeTab: 'connection' | 'cameras' | 'streaming' | 'diagnostics' | 'logs' | 'guide';
  setActiveTab: (tab: 'connection' | 'cameras' | 'streaming' | 'diagnostics' | 'logs' | 'guide') => void;
  status: 'ONLINE' | 'OFFLINE' | 'TESTING';
  gatewayId: string;
  localIp: string;
  port: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  status,
  gatewayId,
  localIp,
  port,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyConfig = () => {
    const configSnippet = JSON.stringify({
      gatewayId,
      gatewayIp: localIp,
      gatewayPort: port,
      clientHeaders: {
        'X-Gateway-Id': gatewayId,
        'X-Gateway-Auth': '<SUA_SENHA>',
      },
    }, null, 2);

    navigator.clipboard.writeText(configSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems: Array<{ id: HeaderProps['activeTab']; label: string }> = [
    { id: 'connection', label: 'Conexão & Gateway' },
    { id: 'cameras', label: 'Câmeras ONVIF' },
    { id: 'streaming', label: 'Transmissão & Snapshot' },
    { id: 'diagnostics', label: 'Diagnóstico' },
    { id: 'logs', label: 'Logs de Eventos' },
    { id: 'guide', label: 'Manual Windows' },
  ];

  return (
    <header className="w-full bg-slate-950 border-b border-slate-800 text-slate-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Zone 1: Single Brand Wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              CIBERCOP GATEWAY
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono font-medium border border-slate-700">
                V1.0
              </span>
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action & Live Indicator */}
        <div className="flex items-center gap-2.5 shrink-0">
          <a
            href="/download"
            download="CIBERCOP-Gateway-V1-Windows-x64.zip"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded shadow-md shadow-cyan-900/20 transition-all active:scale-95 whitespace-nowrap"
            title="Baixar pacote Windows x64 completo (.zip - 71.2 MB)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar Windows (.zip)</span>
          </a>

          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'ONLINE'
                  ? 'bg-emerald-500 animate-pulse'
                  : status === 'TESTING'
                  ? 'bg-amber-500 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            <span className={status === 'ONLINE' ? 'text-emerald-400 font-semibold' : status === 'TESTING' ? 'text-amber-400' : 'text-rose-400'}>
              {status}
            </span>
          </div>

          <button
            onClick={handleCopyConfig}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors whitespace-nowrap"
            title="Copiar dados de configuração para o APK/PWA"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado' : 'Config APK'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
