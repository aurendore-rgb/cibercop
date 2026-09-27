import React, { useState } from 'react';
import {
  FileCode,
  ShieldCheck,
  Package,
  Copy,
  Check,
  Smartphone,
  ExternalLink,
  Download,
  CheckCircle2,
} from 'lucide-react';

interface WindowsSetupGuideProps {
  localIp: string;
  port: number;
  gatewayId: string;
  password?: string;
}

export const WindowsSetupGuide: React.FC<WindowsSetupGuideProps> = ({
  localIp,
  port,
  gatewayId,
  password = 'cibercop2026',
}) => {
  const [copiedBatch, setCopiedBatch] = useState(false);
  const [copiedPs, setCopiedPs] = useState(false);
  const [copiedPkg, setCopiedPkg] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  const batchCode = `@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Execute como Administrador!
    pause
    exit /b 1
)
netsh advfirewall firewall add rule name="CIBERCOP Gateway 18902" dir=in action=allow protocol=TCP localport=18902 profile=any
echo Porta 18902 liberada com sucesso!
pause`;

  const psCode = `# PowerShell como Administrador
New-NetFirewallRule -DisplayName "CIBERCOP Gateway 18902" -Direction Inbound -LocalPort 18902 -Protocol TCP -Action Allow -Profile Any`;

  const pkgCode = `# Gerar executavel Windows x64 independente
npx @yao-pkg/pkg server.js --targets node18-win-x64 --output dist-win/CIBERCOP-Gateway-V1.exe`;

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-cyan-400" />
            Guia de Instalação, Firewall & Empacotamento Windows x64
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Pacote pré-compilado e pronto: <code className="text-cyan-300 font-mono">CIBERCOP-Gateway-V1-Windows-x64.zip</code> (71.2 MB)
          </p>
        </div>
        <a
          href="/download"
          download="CIBERCOP-Gateway-V1-Windows-x64.zip"
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg shadow-lg shadow-cyan-950/40 text-xs transition-transform active:scale-95 whitespace-nowrap cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Baixar Pacote Windows (71.2 MB)</span>
        </a>
      </div>

      {/* Grid of Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        {/* Step 1: Firewall */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              1. Liberação no Windows Firewall (Porta 18902)
            </h3>
            <button
              onClick={() => copyToClipboard(batchCode, setCopiedBatch)}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-[11px]"
            >
              {copiedBatch ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedBatch ? 'Copiado' : 'Copiar .bat'}</span>
            </button>
          </div>

          <p className="text-slate-400">
            O Windows bloqueia portas de rede por padrão para conexões externas. Execute o script <code className="text-cyan-300 font-mono">scripts/windows-firewall-setup.bat</code> como Administrador:
          </p>

          <pre className="font-mono text-cyan-300 bg-slate-950 p-3 rounded border border-slate-800 overflow-x-auto select-all text-[11px]">
            {batchCode}
          </pre>

          <p className="text-slate-500 text-[11px]">
            Ou use o comando PowerShell se preferir:
          </p>

          <div className="relative">
            <pre className="font-mono text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800 overflow-x-auto text-[11px]">
              {psCode}
            </pre>
          </div>
        </div>

        {/* Step 2: Packaging Windows x64 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-cyan-400" />
              2. Empacotamento CIBERCOP-Gateway-V1.exe
            </h3>
            <button
              onClick={() => copyToClipboard(pkgCode, setCopiedPkg)}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-[11px]"
            >
              {copiedPkg ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedPkg ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>

          <p className="text-slate-400">
            Para gerar o executável autônomo para Windows x64 que roda com 1 clique:
          </p>

          <pre className="font-mono text-cyan-300 bg-slate-950 p-3 rounded border border-slate-800 overflow-x-auto select-all text-[11px]">
            {pkgCode}
          </pre>

          <div className="space-y-1.5 text-slate-400 pt-1">
            <p className="font-semibold text-white">Distribuição do FFmpeg:</p>
            <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
              <li>Coloque o arquivo <code className="text-white font-mono">ffmpeg.exe</code> na mesma pasta ou no diretório <code className="text-white font-mono">bin/</code>.</li>
              <li>O executável localiza o FFmpeg automaticamente para conversão RTSP → HLS de ultrabaixa latência.</li>
              <li>Não requer instalação de Node.js na máquina do cliente final.</li>
            </ul>
          </div>
        </div>

        {/* Step 3: APK / PWA Integration */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 md:col-span-2">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              3. Conectando o APK/PWA CIBERCOP ao Gateway
            </h3>
          </div>

          <p className="text-slate-400">
            No aplicativo cliente CIBERCOP (celular Android ou tablet na mesma rede Wi-Fi), insira as seguintes credenciais na tela de conexão de Gateway:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono text-xs pt-1">
            <div className="p-3 bg-slate-950 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">IP do Gateway</span>
              <strong className="text-cyan-300 text-sm">{localIp}</strong>
            </div>

            <div className="p-3 bg-slate-950 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Porta Oficial</span>
              <strong className="text-cyan-300 text-sm">{port}</strong>
            </div>

            <div className="p-3 bg-slate-950 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Gateway ID</span>
              <strong className="text-cyan-300 text-sm">{gatewayId}</strong>
            </div>

            <div className="p-3 bg-slate-950 rounded border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Senha / Token</span>
                <strong className="text-emerald-400 text-sm font-mono">{password}</strong>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(password, setCopiedPass)}
                className="p-1 text-slate-400 hover:text-white"
                title="Copiar Senha"
              >
                {copiedPass ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
