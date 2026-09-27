import React, { useState } from 'react';
import {
  Search,
  Plus,
  Tv,
  CheckCircle2,
  XCircle,
  Activity,
  Trash2,
  Play,
  RotateCw,
  Camera as CameraIcon,
  Info,
  Shield,
} from 'lucide-react';
import { CameraClientRecord, DiscoveredCamera } from '../types/gateway';

interface OnvifCameraPanelProps {
  cameras: CameraClientRecord[];
  onRefreshCameras: () => Promise<void>;
  onDiscoverOnvif: () => Promise<DiscoveredCamera[]>;
  onAddCamera: (cam: {
    name: string;
    ip: string;
    port: number;
    username: string;
    password?: string;
    rtspPort?: number;
    manufacturer?: string;
  }) => Promise<void>;
  onDeleteCamera: (id: string) => Promise<void>;
  onSelectCameraForStream: (cam: CameraClientRecord) => void;
  gatewayId?: string;
  gatewayPassword?: string;
}

export const OnvifCameraPanel: React.FC<OnvifCameraPanelProps> = ({
  cameras,
  onRefreshCameras,
  onDiscoverOnvif,
  onAddCamera,
  onDeleteCamera,
  onSelectCameraForStream,
  gatewayId,
  gatewayPassword,
}) => {
  const [discovering, setDiscovering] = useState(false);
  const [discoveredList, setDiscoveredList] = useState<DiscoveredCamera[] | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // New Camera Form
  const [formName, setFormName] = useState('Câmera Intelbras 01');
  const [formIp, setFormIp] = useState('192.168.1.108');
  const [formPort, setFormPort] = useState(80);
  const [formRtspPort, setFormRtspPort] = useState(554);
  const [formUsername, setFormUsername] = useState('admin');
  const [formPassword, setFormPassword] = useState('');
  const [formManufacturer, setFormManufacturer] = useState('Intelbras');
  const [savingCam, setSavingCam] = useState(false);

  // Testing TCP states
  const [testingCamId, setTestingCamId] = useState<string | null>(null);
  const [tcpTestResults, setTcpTestResults] = useState<Record<string, { reachable: boolean; latencyMs?: number; error?: string }>>({});

  // ONVIF Inspect modal/state
  const [inspectingCam, setInspectingCam] = useState<CameraClientRecord | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectData, setInspectData] = useState<{
    deviceInfo?: any;
    profiles?: any[];
    streamUri?: string;
    error?: string;
  } | null>(null);

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const results = await onDiscoverOnvif();
      setDiscoveredList(results);
      await onRefreshCameras();
    } finally {
      setDiscovering(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCam(true);
    try {
      await onAddCamera({
        name: formName,
        ip: formIp,
        port: formPort,
        rtspPort: formRtspPort,
        username: formUsername,
        password: formPassword,
        manufacturer: formManufacturer,
      });
      setShowAddForm(false);
      setFormPassword('');
      await onRefreshCameras();
    } finally {
      setSavingCam(false);
    }
  };

  const handleTestTcp = async (cam: CameraClientRecord) => {
    setTestingCamId(cam.id);
    try {
      const res = await fetch(`/api/camera/test?ip=${encodeURIComponent(cam.ip)}&port=${cam.port}`);
      const data = await res.json();
      setTcpTestResults(prev => ({
        ...prev,
        [cam.id]: {
          reachable: data.reachable,
          latencyMs: data.latencyMs,
          error: data.error,
        },
      }));
      await onRefreshCameras();
    } catch (err) {
      setTcpTestResults(prev => ({
        ...prev,
        [cam.id]: { reachable: false, error: (err as Error).message },
      }));
    } finally {
      setTestingCamId(null);
    }
  };

  const handleInspectOnvif = async (cam: CameraClientRecord) => {
    setInspectingCam(cam);
    setInspectLoading(true);
    setInspectData(null);

    try {
      // 1. Get Device Info
      const endpoint = cam.onvifEndpoint || `http://${cam.ip}:${cam.port}/onvif/device_service`;
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (gatewayId && gatewayPassword) {
        authHeaders['X-Gateway-Id'] = gatewayId;
        authHeaders['X-Gateway-Auth'] = gatewayPassword;
      }

      const devRes = await fetch('/api/onvif/device-info', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ endpoint, username: cam.username, password: formPassword || undefined }),
      });
      const devJson = await devRes.json();

      // 2. Get Capabilities
      const capRes = await fetch('/api/onvif/capabilities', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ endpoint, username: cam.username, password: formPassword || undefined }),
      });
      const capJson = await capRes.json();
      const mediaEndpoint = capJson.capabilities?.mediaXAddr || `http://${cam.ip}:${cam.port}/onvif/media_service`;

      // 3. Get Profiles
      const profRes = await fetch('/api/onvif/profiles', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ mediaEndpoint, username: cam.username, password: formPassword || undefined }),
      });
      const profJson = await profRes.json();

      // 4. Get Stream URI for profile 0 if exists
      let streamUri = '';
      if (profJson.profiles && profJson.profiles.length > 0) {
        const token = profJson.profiles[0].token;
        const uriRes = await fetch('/api/onvif/stream-uri', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ mediaEndpoint, profileToken: token, username: cam.username, password: formPassword || undefined }),
        });
        const uriJson = await uriRes.json();
        streamUri = uriJson.streamUri || '';
      }

      setInspectData({
        deviceInfo: devJson.info,
        profiles: profJson.profiles,
        streamUri,
        error: !devJson.success ? devJson.error : undefined,
      });
    } catch (err) {
      setInspectData({ error: (err as Error).message });
    } finally {
      setInspectLoading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Action Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <CameraIcon className="w-4 h-4 text-cyan-400" />
            Gerenciamento de Câmeras IP & ONVIF
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Descoberta WS-Discovery em tempo real e configuração de credenciais da câmera (Intelbras, Dahua, Hikvision)
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Button ONVIF DISCOVERY REAL */}
          <button
            onClick={handleDiscover}
            disabled={discovering}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Search className={`w-3.5 h-3.5 ${discovering ? 'animate-spin' : ''}`} />
            <span>{discovering ? 'BUSCANDO NA REDE LOCAL...' : 'DESCOBERTA ONVIF REAL'}</span>
          </button>

          {/* Button ADICIONAR CÂMERA MANUAL */}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg flex items-center gap-2 transition-colors border border-slate-700"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Adicionar Câmera</span>
          </button>
        </div>
      </div>

      {/* Discovery Results Banner */}
      {discoveredList !== null && (
        <div className="bg-slate-900/90 border border-cyan-900/50 rounded-xl p-4 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              Resultado da Descoberta UDP (239.255.255.250:3702)
            </span>
            <span className="font-mono text-slate-400">
              Dispositivos encontrados: <strong className="text-white">{discoveredList.length}</strong>
            </span>
          </div>

          {discoveredList.length === 0 ? (
            <p className="text-slate-400">
              Nenhuma câmera ONVIF respondeu na rede local. Verifique se as câmeras estão ligadas no mesmo switch/roteador e com o protocolo ONVIF habilitado nas configurações da câmera.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {discoveredList.map((d) => (
                <div key={d.id} className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{d.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 font-mono text-[10px] border border-cyan-800">
                      {d.manufacturer}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    IP: <span className="text-white">{d.ip}</span> | Porta: <span className="text-white">{d.port}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate" title={d.primaryXAddr}>
                    XAddr: {d.primaryXAddr}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Camera Form Modal / Expandable */}
      {showAddForm && (
        <div className="bg-slate-900 border border-cyan-800/40 rounded-xl p-6 shadow-xl space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Cadastrar Nova Câmera (Compatível Intelbras / ONVIF)
            </h3>
            <span className="text-[11px] text-slate-400">Credenciais exclusivas da câmera IP</span>
          </div>

          <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Nome de Identificação</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2.5 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Fabricante</label>
                <select
                  value={formManufacturer}
                  onChange={(e) => setFormManufacturer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2.5 font-mono"
                >
                  <option value="Intelbras">Intelbras (Padrão)</option>
                  <option value="Dahua">Dahua</option>
                  <option value="Hikvision">Hikvision</option>
                  <option value="ONVIF Generic">ONVIF Genérico</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Endereço IP da Câmera</label>
                <input
                  type="text"
                  value={formIp}
                  onChange={(e) => setFormIp(e.target.value)}
                  placeholder="192.168.1.108"
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2.5 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Porta HTTP / ONVIF</label>
                <input
                  type="number"
                  value={formPort}
                  onChange={(e) => setFormPort(parseInt(e.target.value, 10) || 80)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2.5 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Porta RTSP</label>
                <input
                  type="number"
                  value={formRtspPort}
                  onChange={(e) => setFormRtspPort(parseInt(e.target.value, 10) || 554)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2.5 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Usuário da Câmera</label>
                <input
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2.5 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Senha da Câmera</label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Senha configurada na câmera"
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2.5 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingCam}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded"
              >
                {savingCam ? 'Salvando...' : 'Salvar Câmera'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cameras List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            Câmeras Cadastradas ({cameras.length})
          </h3>
          <span className="text-xs text-slate-500">
            Armazenadas localmente no Gateway
          </span>
        </div>

        {cameras.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Nenhuma câmera cadastrada ainda. Clique em "DESCOBERTA ONVIF REAL" ou em "Adicionar Câmera" para começar.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {cameras.map((cam) => {
              const testResult = tcpTestResults[cam.id];
              return (
                <div key={cam.id} className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{cam.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                        {cam.manufacturer || 'ONVIF'}
                      </span>
                      {cam.status === 'online' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono font-semibold border border-emerald-800">
                          ONLINE
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700">
                          {cam.status.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-slate-400 flex flex-wrap items-center gap-3">
                      <span>IP: <strong className="text-slate-200">{cam.ip}</strong></span>
                      <span>Porta ONVIF: <strong className="text-slate-200">{cam.port}</strong></span>
                      <span>Porta RTSP: <strong className="text-slate-200">{cam.rtspPort || 554}</strong></span>
                      <span>Usuário: <strong className="text-slate-200">{cam.username}</strong></span>
                    </div>

                    {testResult && (
                      <div className="text-[11px] pt-1">
                        {testResult.reachable ? (
                          <span className="text-emerald-400 font-mono flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            TCP Porta {cam.port} respondendo ({testResult.latencyMs}ms)
                          </span>
                        ) : (
                          <span className="text-rose-400 font-mono flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            TCP Inacessível: {testResult.error}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Camera Actions */}
                  <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                    {/* Test TCP */}
                    <button
                      onClick={() => handleTestTcp(cam)}
                      disabled={testingCamId === cam.id}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700 flex items-center gap-1.5"
                      title="Testar conexão TCP na porta"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${testingCamId === cam.id ? 'animate-spin' : ''}`} />
                      <span>Testar TCP</span>
                    </button>

                    {/* Inspect ONVIF */}
                    <button
                      onClick={() => handleInspectOnvif(cam)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-xs font-medium border border-slate-700 flex items-center gap-1.5"
                      title="Inspecionar parâmetros SOAP ONVIF"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>ONVIF Info</span>
                    </button>

                    {/* Start Stream */}
                    <button
                      onClick={() => onSelectCameraForStream(cam)}
                      className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-xs flex items-center gap-1.5"
                      title="Abrir reprodutor de vídeo"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Transmitir</span>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => onDeleteCamera(cam.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded transition-colors"
                      title="Excluir câmera"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ONVIF Inspector Details Modal */}
      {inspectingCam && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Tv className="w-4 h-4 text-cyan-400" />
                  Inspeção ONVIF: {inspectingCam.name}
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {inspectingCam.ip}:{inspectingCam.port}
                </span>
              </div>
              <button
                onClick={() => setInspectingCam(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕ Fechar
              </button>
            </div>

            {inspectLoading ? (
              <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RotateCw className="w-6 h-6 text-cyan-400 animate-spin" />
                <span>Consultando GetDeviceInformation, GetCapabilities e GetProfiles via SOAP...</span>
              </div>
            ) : inspectData?.error ? (
              <div className="p-4 bg-rose-950/50 border border-rose-800 rounded-lg text-xs text-rose-300 space-y-1">
                <p className="font-bold">Falha na consulta ONVIF:</p>
                <p className="font-mono">{inspectData.error}</p>
                <p className="text-[11px] text-slate-400 pt-1">
                  Certifique-se de que a senha da câmera foi informada ao cadastrar e que a porta {inspectingCam.port} é a porta ONVIF do dispositivo.
                </p>
              </div>
            ) : inspectData ? (
              <div className="space-y-4 text-xs">
                {/* Device Info */}
                {inspectData.deviceInfo && (
                  <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-1">
                    <span className="text-cyan-400 font-semibold uppercase font-mono text-[10px]">GetDeviceInformation</span>
                    <div className="grid grid-cols-2 gap-2 text-slate-300 pt-1">
                      <div>Fabricante: <strong className="text-white">{inspectData.deviceInfo.manufacturer}</strong></div>
                      <div>Modelo: <strong className="text-white">{inspectData.deviceInfo.model}</strong></div>
                      <div>Firmware: <strong className="text-white">{inspectData.deviceInfo.firmwareVersion}</strong></div>
                      <div>Serial: <strong className="text-white font-mono">{inspectData.deviceInfo.serialNumber}</strong></div>
                    </div>
                  </div>
                )}

                {/* Profiles */}
                {inspectData.profiles && (
                  <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                    <span className="text-cyan-400 font-semibold uppercase font-mono text-[10px]">
                      GetProfiles ({inspectData.profiles.length} canais encontrados)
                    </span>
                    <div className="space-y-1 pt-1">
                      {inspectData.profiles.map((p, i) => (
                        <div key={i} className="p-2 bg-slate-900 rounded border border-slate-800 flex items-center justify-between font-mono text-[11px]">
                          <div>
                            <span className="text-white font-bold">{p.name || p.token}</span>
                            <span className="text-slate-400 ml-2">Token: {p.token}</span>
                          </div>
                          {p.videoEncoderConfiguration && (
                            <span className="text-cyan-300">
                              {p.videoEncoderConfiguration.encoding} {p.videoEncoderConfiguration.resolution?.width}x{p.videoEncoderConfiguration.resolution?.height}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* RTSP Stream URI */}
                {inspectData.streamUri && (
                  <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-1">
                    <span className="text-cyan-400 font-semibold uppercase font-mono text-[10px]">GetStreamUri (RTSP Real)</span>
                    <p className="font-mono text-emerald-400 text-[11px] break-all bg-slate-900 p-2 rounded border border-slate-800">
                      {inspectData.streamUri}
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
