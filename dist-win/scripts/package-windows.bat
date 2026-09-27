@echo off
:: ============================================================================
:: CIBERCOP GATEWAY V1 - BUILD & PACKAGE FOR WINDOWS X64
:: Produces: CIBERCOP-Gateway-V1.exe
:: ============================================================================

echo =======================================================
echo     GERANDO EXECUTAVEL WINDOWS: CIBERCOP-Gateway-V1.exe
echo =======================================================
echo.

echo 1. Instalando dependencias de producao...
call npm install

echo 2. Compilando interface web React...
call npm run build

echo 3. Preparando pasta de distribuicao...
if not exist "dist-win" mkdir "dist-win"

echo 4. Empacotando executavel com PKG...
npx @yao-pkg/pkg server.js --targets node18-win-x64 --output dist-win/CIBERCOP-Gateway-V1.exe

echo.
echo =======================================================
echo 5. Copiando dependencias auxiliares:
echo    - Coloque o binario ffmpeg.exe em: dist-win/bin/ffmpeg.exe
echo    - O arquivo gateway-config.json sera gerado automaticamente na primeira execucao
echo =======================================================
echo Concluido! Executavel gerado em: dist-win/CIBERCOP-Gateway-V1.exe
pause
