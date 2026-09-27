import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Activity,
  Server,
  Key,
  Network,
  RotateCw,
  Save,
  Check,
  AlertTriangle,
  Download,
  Copy,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { ConnectionTestResult } from '../types/gateway';

interface InitialConnectionCardProps {
  gatewayId: string;
  setGatewayId: (id: string) => void;
  password: string;
  setPassword: (pwd: string) => void;
  port: number;
  setPort: (port: number) => void;
  localIp: string;
  status: 'ONLINE' | 'OFFLINE' | 'TESTING';
  onRunTest: () => Promise<void>;
  testResult: ConnectionTestResult | null;
  onSaveConfig: () => Promise<void>;
  savingConfig: boolean;
  testing: boolean;
}

export const InitialConnectionCard: React.FC<InitialConnectionCardProps> = ({
  gatewayId,
  setGatewayId,
  password,
  setPassword,
  port,
  setPort,
  localIp,
  status,
  onRunTest,
  testResult,
  onSaveConfig,
  savingConfig,
  testing,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const handleDownloadFile = () => {
    setDownloading(true);
    try {
      const a = document.createElement('a');
      a.href = '/download';
      a.setAttribute('download', 'CIBERCOP-Gateway-V1-Windows-x64.zip');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadDone(true);
      setTimeout(() => setDownloadDone(false), 3000);
    } catch (err) {
      console.error(err);
      window.location.href = '/download';
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  };

  const handleCopyDirectLink = () => {
    const fullUrl = `${window.location.origin}/download`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(password);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handleCopyIp = () => {
    navigator.clipboard.writeText(localIp);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(gatewayId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveConfig();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* ======================================================== */}
      {/* CARD DE DOWNLOAD EXECUTÁVEL WINDOWS (100% DIRETO NO NAVEGADOR) */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-br from-cyan-950/60 via-slate-900 to-slate-950 border-2 border-cyan-500/50 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-cyan-800/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-300 shrink-0 shadow-lg shadow-cyan-950">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Download do Instalador Windows x64
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-900/80 text-cyan-300 font-mono font-semibold border border-cyan-700">
                  71.2 MB
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Pacote portátil pronto: <code className="text-cyan-300 font-mono">CIBERCOP-Gateway-V1.exe</code> + <code className="text-cyan-300 font-mono">ffmpeg.exe</code> + Regras de Firewall
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 text-xs font-mono font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Binário Pronto
          </span>
        </div>

        {/* Action Buttons: Direct Download + Link Copy */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadFile}
            disabled={downloading}
            className="w-full sm:flex-1 py-3.5 px-5 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 font-extrabold text-sm rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-xl shadow-cyan-950/50 active:scale-[0.98] cursor-pointer"
          >
            <Download className={`w-5 h-5 ${downloading ? 'animate-bounce' : ''}`} />
            <span>
              {downloadDone
                ? 'DOWNLOAD INICIADO NO NAVEGADOR!'
                : downloading
                ? 'PREPARANDO DOWNLOAD...'
                : 'BAIXAR CIBERCOP-Gateway-V1-Windows-x64.zip (71.2 MB)'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleCopyDirectLink}
            className="w-full sm:w-auto py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-700 whitespace-nowrap cursor-pointer"
            title="Copiar URL completa de download"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
            <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link Direto'}</span>
          </button>
        </div>

        {/* Connection Credentials Box (Requested visible) */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              Credenciais & Parâmetros de Conexão do Gateway
            </span>
            <span className="text-[11px] text-slate-400">Use estes dados no seu APK/PWA</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* IP */}
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase block font-medium">IP DO GATEWAY</span>
              <div className="flex items-center justify-between gap-1">
                <strong className="text-cyan-300 font-mono text-sm truncate">{localIp || '127.0.0.1'}</strong>
                <button
                  type="button"
                  onClick={handleCopyIp}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                  title="Copiar IP"
                >
                  {copiedIp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* PORT */}
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase block font-medium">PORTA OFICIAL</span>
              <div className="flex items-center justify-between gap-1">
                <strong className="text-cyan-300 font-mono text-sm">{port}</strong>
                <span className="text-[10px] text-slate-500 font-mono">TCP</span>
              </div>
            </div>

            {/* GATEWAY ID */}
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase block font-medium">GATEWAY ID</span>
              <div className="flex items-center justify-between gap-1">
                <strong className="text-cyan-300 font-mono text-sm truncate">{gatewayId}</strong>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                  title="Copiar ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* SENHA / AUTH TOKEN */}
            <div className="p-3 bg-slate-900 rounded-lg border border-cyan-800/40 space-y-1">
              <span className="text-[10px] text-cyan-400 uppercase block font-medium">SENHA DO GATEWAY</span>
              <div className="flex items-center justify-between gap-1">
                <strong className="text-emerald-400 font-mono text-sm truncate">
                  {showPassword ? password : '••••••••••••'}
                </strong>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-slate-400 hover:text-white transition-colors"
                    title={showPassword ? 'Ocultar' : 'Ver senha'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="p-1 text-slate-400 hover:text-white transition-colors"
                    title="Copiar Senha"
                  >
                    {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Connection Console Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        {/* Card Header */}
        <div className="bg-slate-950 px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-3">
              CIBERCOP GATEWAY
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 font-mono border border-cyan-800/60 font-semibold">
                V1.0
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Gateway local para conexão oficial entre Câmeras IP e o APK/PWA CIBERCOP
            </p>
          </div>

          {/* Big Status Badge */}
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status === 'ONLINE'
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                  : status === 'TESTING'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-400 font-normal">STATUS:</span>
            <span
              className={`font-bold ${
                status === 'ONLINE'
                  ? 'text-emerald-400'
                  : status === 'TESTING'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {status}
            </span>
          </div>
        </div>

        {/* Card Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Field 1: ID DO GATEWAY */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              ID DO GATEWAY
            </label>
            <input
              type="text"
              value={gatewayId}
              onChange={(e) => setGatewayId(e.target.value)}
              placeholder="Ex: CIBERCOP-GW01"
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white font-mono text-sm px-3.5 py-2.5 rounded-lg outline-none transition-colors"
              required
            />
            <span className="text-[11px] text-slate-500 block">
              Identificador único que será configurado no cliente APK/PWA CIBERCOP.
            </span>
          </div>

          {/* Field 2: SENHA DO GATEWAY */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              SENHA
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha de acesso do Gateway"
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white font-mono text-sm px-3.5 py-2.5 pr-10 rounded-lg outline-none transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors"
                title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <span className="text-[11px] text-slate-500 block">
              Utilizada para autenticar as requisições do APK/PWA via cabeçalhos seguros ou Bearer token.
            </span>
          </div>

          {/* Field 3 & 4: PORTA & IP LOCAL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* PORTA */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5 text-cyan-400" />
                PORTA
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value, 10) || 18902)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 text-white font-mono text-sm px-3.5 py-2.5 rounded-lg outline-none transition-colors tabular-nums"
                min={1}
                max={65535}
              />
              <span className="text-[11px] text-slate-500 block">
                Porta oficial padrão: <strong className="text-slate-400 font-mono">18902</strong>
              </span>
            </div>

            {/* IP LOCAL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                IP LOCAL
              </label>
              <div className="bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-sm px-3.5 py-2.5 rounded-lg flex items-center justify-between">
                <span>{localIp || 'Detectando...'}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Automático</span>
              </div>
              <span className="text-[11px] text-slate-500 block">
                Endereço detectado nas interfaces de rede do computador.
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            {/* BOTÃO TESTAR CONEXÃO */}
            <button
              type="button"
              onClick={onRunTest}
              disabled={testing}
              className="w-full sm:flex-1 py-3 px-4 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-900/20 active:scale-[0.98] disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'VERIFICANDO FLUXO...' : 'TESTAR CONEXÃO'}</span>
            </button>

            {/* BOTÃO SALVAR CONFIGURAÇÃO */}
            <button
              type="submit"
              disabled={savingConfig}
              className="w-full sm:w-auto py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-700"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Salvo</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-slate-400" />
                  <span>Salvar Dados</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Real Connection Verification Breakdown */}
      {testResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Resultado da Verificação Real de Conexão
            </h2>
            <span className="text-xs font-mono text-slate-400">
              Latência: <strong className="text-white">{testResult.latencyMs}ms</strong>
            </span>
          </div>

          {/* Diagnostic Stages */}
          <div className="space-y-2">
            {testResult.stages.map((st, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-3 text-xs p-2.5 rounded bg-slate-950/70 border border-slate-800/80"
              >
                <div className="flex items-start gap-2">
                  {st.status === 'ok' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : st.status === 'failed' ? (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-mono font-medium text-slate-200 uppercase">{st.stage}</span>
                    <p className="text-slate-400 mt-0.5">{st.details}</p>
                  </div>
                </div>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    st.status === 'ok'
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                      : st.status === 'failed'
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                      : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                  }`}
                >
                  {st.status}
                </span>
              </div>
            ))}
          </div>

          {/* Summary Banner */}
          {testResult.success ? (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>
                <strong>Gateway 100% ONLINE e verificado:</strong> IP, porta TCP, HTTP /health e autenticação validados com sucesso.
              </span>
            </div>
          ) : (
            <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-lg text-xs text-rose-300 flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>
                <strong>Falha na verificação:</strong> Verifique se a porta 18902 está aberta no Firewall e se a senha do Gateway confere.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
