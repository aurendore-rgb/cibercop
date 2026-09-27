import React, { useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  Network,
  RotateCw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
} from 'lucide-react';
import { DiagnosticsData } from '../types/gateway';

export const DiagnosticsPanel: React.FC = () => {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/diagnostics');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  const handleCopyNetsh = () => {
    if (!data?.firewall.netshCommand) return;
    navigator.clipboard.writeText(data.firewall.netshCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Diagnóstico Completo do Gateway
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Métricas de hardware, interfaces de rede detectadas e status do motor de mídia FFmpeg
          </p>
        </div>

        <button
          onClick={fetchDiagnostics}
          disabled={loading}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar Diagnóstico</span>
        </button>
      </div>

      {data && (
        <div className="space-y-6">
          {/* Key Stat Cards (Single Elevation, no nested cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status Geral</span>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-lg font-bold font-mono text-emerald-400">{data.status.toUpperCase()}</span>
              </div>
              <span className="text-[11px] text-slate-500">Versão {data.version}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tempo de Atividade</span>
              <div className="text-lg font-bold font-mono text-white tabular-nums">
                {formatUptime(data.uptimeSeconds)}
              </div>
              <span className="text-[11px] text-slate-500">Uptime ininterrupto</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Câmeras Conectadas</span>
              <div className="text-lg font-bold font-mono text-cyan-400 tabular-nums">
                {data.camerasOnline} / {data.camerasTotal}
              </div>
              <span className="text-[11px] text-slate-500">Online no Gateway</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Streams HLS Ativos</span>
              <div className="text-lg font-bold font-mono text-white tabular-nums">
                {data.streamsActive}
              </div>
              <span className="text-[11px] text-slate-500">Sessões de vídeo ativas</span>
            </div>
          </div>

          {/* Engine & Network Split Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* FFmpeg Engine Status */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Cpu className="w-4 h-4 text-cyan-400" />
                Motor de Transmissão (Media Engine)
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Disponibilidade do FFmpeg:</span>
                  {data.ffmpeg.available ? (
                    <span className="text-emerald-400 font-mono font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      INSTALADO & OPERANTE
                    </span>
                  ) : (
                    <span className="text-rose-400 font-mono font-semibold flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" />
                      NÃO ENCONTRADO
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400">Caminho do Binário:</span>
                  <p className="font-mono text-cyan-300 bg-slate-950 p-2 rounded border border-slate-800 break-all">
                    {data.ffmpeg.binaryPath}
                  </p>
                </div>

                {data.ffmpeg.version && (
                  <div className="space-y-1">
                    <span className="text-slate-400">Versão Detectada:</span>
                    <p className="font-mono text-slate-300 bg-slate-950 p-2 rounded border border-slate-800 text-[11px] truncate">
                      {data.ffmpeg.version}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Network Interfaces */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Network className="w-4 h-4 text-cyan-400" />
                Interfaces de Rede Detectadas
              </h3>

              <div className="space-y-2 text-xs">
                {data.allInterfaces.map((iface, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-950 rounded border border-slate-800 flex items-center justify-between font-mono">
                    <div>
                      <span className="text-slate-400">{iface.name}: </span>
                      <strong className="text-white text-xs">{iface.address}</strong>
                    </div>
                    {iface.isPrimary && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-semibold">
                        IP PRINCIPAL
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Windows Firewall Helper Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Regra de Firewall do Windows (Porta {data.firewall.recommendedPort})
              </h3>
              <button
                onClick={handleCopyNetsh}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs border border-slate-700"
              >
                {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCmd ? 'Comando Copiado' : 'Copiar Comando Netsh'}</span>
              </button>
            </div>

            <p className="text-slate-400">
              Para liberar o acesso do APK/PWA CIBERCOP ao Gateway em outro dispositivo na mesma rede Wi-Fi/cabeada, execute o comando abaixo no Prompt de Comando (CMD) como Administrador:
            </p>

            <pre className="font-mono text-cyan-300 bg-slate-950 p-3 rounded border border-slate-800 overflow-x-auto select-all">
              {data.firewall.netshCommand}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
