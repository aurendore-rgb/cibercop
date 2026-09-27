================================================================================
                    CIBERCOP GATEWAY V1.0 - WINDOWS X64
================================================================================

Este pacote contem a versao standalone oficial do CIBERCOP Gateway para Windows.

CONTEUDO DESTA PASTA:
---------------------
1. CIBERCOP-Gateway-V1.exe  -> Executavel principal do Gateway (porta TCP 18902)
2. dist/                    -> Interface grafica web (HTML5, Tailwind, React, Player HLS)
3. bin/ffmpeg.exe           -> Motor de transcodificacao de video RTSP -> HLS (incluso)
4. scripts/                 -> Scripts de liberacao automatica no Firewall do Windows
5. data/                    -> Armazenamento local de credenciais e configuracoes

PASSO A PASSO PARA INICIAR:
---------------------------
1. LIBERACAO DO FIREWALL (OBRIGATORIO UMA VEZ):
   - Abra a pasta "scripts".
   - Clique com o botao direito em "windows-firewall-setup.bat" e selecione:
     "Executar como administrador".
   - O script liberara a porta TCP 18902 EXCLUSIVAMENTE para a sua REDE LOCAL (LocalSubnet).
   - Nao expoe seu computador para a Internet publica.

2. INICIANDO O GATEWAY:
   - De um duplo clique em "CIBERCOP-Gateway-V1.exe".
   - O Gateway abrira a janela de console mostrando:
     * Status do Gateway: ONLINE
     * Porta escutada    : 0.0.0.0:18902
     * IP Local          : [Seu IP na rede local, ex: 192.168.1.150]
     * FFmpeg            : Detectado e operacional

3. ACESSANDO A INTERFACE NO NAVEGADOR:
   - Abra o navegador no proprio computador ou em outro dispositivo:
     http://localhost:18902   ou   http://[IP-DO-COMPUTADOR]:18902

4. CONECTANDO O APK/PWA CIBERCOP:
   - No celular (Android/iOS) conectado no mesmo Wi-Fi, insira:
     * IP do Gateway: [IP detectado no passo 2]
     * Porta        : 18902
     * Gateway ID   : [ID mostrado na tela, ex: CIBERCOP-VAL01]
     * Senha        : [Senha definida pelo operador]

================================================================================
