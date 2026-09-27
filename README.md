# CIBERCOP GATEWAY V1.0

Gateway local de alta performance para Windows x64 projetado para fazer a ponte entre câmeras IP locais (Intelbras, Dahua, Hikvision e dispositivos ONVIF padrão) e o aplicativo cliente **CIBERCOP (APK/PWA)**.

## Fluxo de Operação
```
CÂMERA IP (ex: Intelbras)
      ↓
REDE LOCAL (IPv4)
      ↓
CIBERCOP GATEWAY (Porta 18902)
      ↓
ONVIF WS-Discovery (UDP 239.255.255.250:3702)
      ↓
Autenticação & SOAP (GetDeviceInformation, GetCapabilities, GetProfiles, GetStreamUri)
      ↓
RTSP (rtsp://user:pass@ip:554/...)
      ↓
FFmpeg Media Engine
      ↓
HLS (/streams/:id/index.m3u8)
      ↓
CIBERCOP GATEWAY HTTP API
      ↓
APK / PWA CIBERCOP
      ↓
VÍDEO REAL EM TEMPO REAL
```

## Porta Principal
- **Porta Oficial**: `18902`
- **Bind**: `0.0.0.0:18902`

## Autenticação com o APK/PWA
O Gateway suporta 3 mecanismos para conectar com o cliente:
1. Header `X-Gateway-Id: <ID>` e `X-Gateway-Auth: <SENHA>`
2. Header `Authorization: Bearer <SENHA>`
3. Parâmetro de query: `?token=<SENHA>` (útil para URLs de vídeo HLS e snapshot direto no navegador/WebView)

## Endpoints Principais

### Status e Saúde
- `GET /health` - Retorna status, versão, gatewayId, porta, ffmpegAvailable, uptime.
- `GET /api/status` - Retorna status online, contagem de câmeras e streams ativos.
- `GET /api/diagnostics` - Diagnóstico completo do sistema e interfaces de rede.
- `POST /api/test-connection` - Testa conexão local/remota (IP, TCP 18902, HTTP, autenticação).

### Câmeras e ONVIF
- `GET /api/onvif/discover` - Executa WS-Discovery real via multicast UDP (retorna lista vazia caso não encontre nenhuma câmera na rede).
- `POST /api/onvif/device-info` - Executa `GetDeviceInformation` via SOAP.
- `POST /api/onvif/profiles` - Executa `GetProfiles` para listar fluxos de vídeo.
- `POST /api/onvif/stream-uri` - Executa `GetStreamUri` para obter a URL RTSP real.
- `GET /api/camera/test?ip=<IP>&port=<PORT>` - Teste de socket TCP real para validar se a porta da câmera está aberta.
- `GET /api/cameras` - Lista de câmeras cadastradas (senhas protegidas).
- `POST /api/cameras` - Cadastra/atualiza credenciais da câmera (IP, porta, usuário, senha).

### Transmissão e Snapshot
- `POST /api/camera/:id/stream` - Inicia sessão de streaming HLS via FFmpeg e retorna `streamUrl`.
- `GET /api/camera/:id/stream` - Consulta status da sessão de streaming.
- `DELETE /api/camera/:id/stream` - Encerra a sessão e libera o processo FFmpeg.
- `GET /api/camera/snapshot?id=<ID>` - Captura imagem JPEG real da câmera.
- `GET /streams/:streamId/index.m3u8` - Distribuição HLS para reprodução no player.

## Firewall do Windows
Execute o script como Administrador:
```cmd
scripts\windows-firewall-setup.bat
```
Ou no PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\windows-firewall-setup.ps1
```

## Empacotamento Windows x64
Para gerar o arquivo `CIBERCOP-Gateway-V1.exe`:
```cmd
scripts\package-windows.bat
```
