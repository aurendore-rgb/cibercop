import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Square,
  Camera,
  RotateCw,
  Tv,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Download,
  AlertCircle,
} from 'lucide-react';
import { CameraClientRecord, StreamSessionClient } from '../types/gateway';

interface StreamPlayerPanelProps {
  cameras: CameraClientRecord[];
  selectedCamera: CameraClientRecord | null;
  onSelectCamera: (cam: CameraClientRecord) => void;
  localIp: string;
  port: number;
  gatewayId?: string;
  gatewayPassword?: string;
}

export const StreamPlayerPanel: React.FC<StreamPlayerPanelProps> = ({
  cameras,
  selectedCamera,
  onSelectCamera,
  localIp,
  port,
  gatewayId,
  gatewayPassword,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [streamSession, setStreamSession] = useState<StreamSessionClient | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Snapshot states
  const [capturingSnapshot, setCapturingSnapshot] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [snapshotTimestamp, setSnapshotTimestamp] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  // Check existing stream if camera selected
  useEffect(() => {
    if (!selectedCamera) {
      if (cameras.length > 0) {
        onSelectCamera(cameras[0]);
      }
      return;
    }

    // Check if camera already has a stream
    fetch(`/api/camera/${selectedCamera.id}/stream`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.status === 'active') {
          setStreamSession(data);
        } else {
          setStreamSession(null);
        }
      })
      .catch(() => setStreamSession(null));
  }, [selectedCamera?.id, cameras]);

  // Handle HLS Video Player Attachment
  useEffect(() => {
    if (!streamSession || !streamSession.streamUrl || !videoRef.current) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    const streamSource = streamSession.streamUrl;

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 5,
      });

      hlsRef.current = hls;
      hls.loadSource(streamSource);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          // auto-play muted fallback
          video.muted = true;
          video.play().catch(() => {});
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari / iOS / Android WebView
      video.src = streamSource;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {});
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamSession?.streamUrl]);

  const handleStartStream = async () => {
    if (!selectedCamera) return;
    setLoadingStream(true);
    setStreamError(null);

    try {
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (gatewayId && gatewayPassword) {
        authHeaders['X-Gateway-Id'] = gatewayId;
        authHeaders['X-Gateway-Auth'] = gatewayPassword;
      }

      const res = await fetch(`/api/camera/${selectedCamera.id}/stream`, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json();

      if (data.success) {
        setStreamSession(data);
      } else {
        setStreamError(data.error || 'Falha ao iniciar transmissão HLS');
      }
    } catch (err) {
      setStreamError((err as Error).message);
    } finally {
      setLoadingStream(false);
    }
  };

  const handleStopStream = async () => {
    if (!selectedCamera) return;
    try {
      const authHeaders: Record<string, string> = {};
      if (gatewayId && gatewayPassword) {
        authHeaders['X-Gateway-Id'] = gatewayId;
        authHeaders['X-Gateway-Auth'] = gatewayPassword;
      }

      await fetch(`/api/camera/${selectedCamera.id}/stream`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      setStreamSession(null);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCaptureSnapshot = async () => {
    if (!selectedCamera) return;
    setCapturingSnapshot(true);
    setSnapshotError(null);

    try {
      const timestamp = new Date().toISOString();
      const res = await fetch(`/api/camera/snapshot?id=${selectedCamera.id}&t=${Date.now()}`);

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Falha na captura HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      setSnapshotUrl(objectUrl);
      setSnapshotTimestamp(timestamp);
    } catch (err) {
      setSnapshotError((err as Error).message);
    } finally {
      setCapturingSnapshot(false);
    }
  };

  const fullStreamUrl = streamSession?.streamUrl
    ? `http://${localIp}:${port}${streamSession.streamUrl}`
    : '';

  const handleCopyStreamUrl = () => {
    if (!fullStreamUrl) return;
    navigator.clipboard.writeText(fullStreamUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Camera Selection & Action Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1 w-full md:w-auto">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Selecione a Câmera para Transmissão
          </label>
          <div className="flex items-center gap-3">
            <select
              value={selectedCamera?.id || ''}
              onChange={(e) => {
                const found = cameras.find(c => c.id === e.target.value);
                if (found) onSelectCamera(found);
              }}
              className="bg-slate-950 border border-slate-700 text-white text-xs rounded-lg px-3 py-2.5 font-mono max-w-md w-full outline-none focus:border-cyan-500"
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.ip}:{c.port}) - {c.manufacturer || 'ONVIF'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stream Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {streamSession?.status === 'active' ? (
            <button
              onClick={handleStopStream}
              className="flex-1 md:flex-none px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>PARAR TRANSMISSÃO</span>
            </button>
          ) : (
            <button
              onClick={handleStartStream}
              disabled={loadingStream || !selectedCamera}
              className="flex-1 md:flex-none px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${loadingStream ? 'animate-spin' : ''}`} />
              <span>{loadingStream ? 'CONECTANDO RTSP/FFMPEG...' : 'INICIAR TRANSMISSÃO REAL'}</span>
            </button>
          )}

          {/* Real Snapshot Capture */}
          <button
            onClick={handleCaptureSnapshot}
            disabled={capturingSnapshot || !selectedCamera}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-medium text-xs rounded-lg flex items-center gap-2 transition-colors border border-slate-700 disabled:opacity-50"
          >
            <Camera className={`w-3.5 h-3.5 ${capturingSnapshot ? 'animate-spin' : ''}`} />
            <span>{capturingSnapshot ? 'CAPTURANDO...' : 'SNAPSHOT REAL'}</span>
          </button>
        </div>
      </div>

      {/* Stream Error Alert */}
      {streamError && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-white">Falha na inicialização do stream:</span>
            <p className="font-mono">{streamError}</p>
            <p className="text-[11px] text-slate-400 pt-1">
              Verifique se a câmera IP está acessível na porta RTSP (padrão 554) e se as credenciais de usuário/senha da câmera estão corretas.
            </p>
          </div>
        </div>
      )}

      {/* Main Video Viewport & Information Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Video Frame */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden relative aspect-video flex items-center justify-center shadow-2xl">
            <video
              ref={videoRef}
              controls
              playsInline
              muted
              className="w-full h-full object-contain bg-black"
            />

            {!streamSession && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center text-xs text-slate-400 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                  <Tv className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Transmissão em Espera</p>
                  <p className="text-slate-400 text-xs mt-1 max-w-sm">
                    Clique em <strong>INICIAR TRANSMISSÃO REAL</strong> para converter o stream RTSP da câmera em HLS com baixa latência para o APK/PWA.
                  </p>
                </div>
              </div>
            )}

            {streamSession?.status === 'active' && (
              <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded bg-black/70 backdrop-blur border border-emerald-500/30 font-mono text-[10px] text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>AO VIVO (HLS 1080p/720p)</span>
              </div>
            )}
          </div>

          {/* Active Stream URL Card for APK/PWA integration */}
          {streamSession && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  URL HLS Oficial para o APK/PWA CIBERCOP
                </span>
                <button
                  onClick={handleCopyStreamUrl}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-mono border border-slate-700"
                >
                  {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedUrl ? 'Copiada' : 'Copiar URL'}</span>
                </button>
              </div>
              <p className="font-mono text-cyan-300 text-[11px] bg-slate-950 p-2.5 rounded border border-slate-800 break-all select-all">
                {fullStreamUrl}
              </p>
              <div className="text-[11px] text-slate-400 flex items-center gap-4 pt-1 font-mono">
                <span>Protocolo: <strong className="text-slate-200">HLS (MPEG-TS)</strong></span>
                <span>Sessão: <strong className="text-slate-200">{streamSession.streamId}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Real Snapshot Capture Frame & Details */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                Captura Snapshot Real (JPEG)
              </h3>
              {snapshotTimestamp && (
                <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                  {new Date(snapshotTimestamp).toLocaleTimeString()}
                </span>
              )}
            </div>

            {snapshotError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded text-xs text-rose-300 font-mono">
                {snapshotError}
              </div>
            )}

            {snapshotUrl ? (
              <div className="space-y-3">
                <div className="rounded-lg overflow-hidden border border-slate-800 bg-black aspect-video relative group">
                  <img
                    src={snapshotUrl}
                    alt="Snapshot Real da Câmera"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                  <a
                    href={snapshotUrl}
                    download={`cibercop-snapshot-${selectedCamera?.id || 'cam'}.jpg`}
                    className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/80 hover:bg-black text-white text-[10px] font-mono flex items-center gap-1 border border-slate-700 opacity-90 group-hover:opacity-100 transition-opacity"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download JPEG</span>
                  </a>
                </div>
                <div className="text-[11px] text-slate-400">
                  Imagem capturada diretamente do pipeline da câmera IP através do Gateway.
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 rounded border border-dashed border-slate-800">
                Nenhum snapshot capturado nesta sessão. Clique no botão <strong>SNAPSHOT REAL</strong> para solicitar uma foto instantânea.
              </div>
            )}
          </div>

          {/* Camera Info Card */}
          {selectedCamera && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
              <span className="font-semibold text-slate-300 block mb-1">Parâmetros da Câmera Ativa</span>
              <div className="space-y-1.5 font-mono text-[11px] text-slate-400">
                <div>Nome: <strong className="text-white">{selectedCamera.name}</strong></div>
                <div>Endereço: <strong className="text-white">{selectedCamera.ip}:{selectedCamera.port}</strong></div>
                <div>RTSP Porta: <strong className="text-white">{selectedCamera.rtspPort || 554}</strong></div>
                <div>Usuário: <strong className="text-white">{selectedCamera.username}</strong></div>
                <div>Fabricante: <strong className="text-cyan-400">{selectedCamera.manufacturer}</strong></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
