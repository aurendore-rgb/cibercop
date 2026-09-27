@echo off
:: ============================================================================
:: CIBERCOP GATEWAY V1 - BUILD & PACKAGE FOR WINDOWS X64
:: Produces: dist-win\CIBERCOP-Gateway-V1.exe
:: ============================================================================

echo.
echo =======================================================
echo     GERANDO EXECUTAVEL WINDOWS: CIBERCOP-Gateway-V1.exe
echo =======================================================
echo.

echo 1. Instalando dependencias...
call npm install

echo 2. Compilando interface web React...
call npm run build

echo 3. Empacotando servidor Node.js com esbuild...
if not exist "dist-server" mkdir "dist-server"
call npx esbuild server.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist-server/server.cjs --external:fsevents --external:vite

echo 4. Preparando pasta de distribuicao dist-win...
if not exist "dist-win" mkdir "dist-win"
if not exist "dist-win\bin" mkdir "dist-win\bin"
if not exist "dist-win\data" mkdir "dist-win\data"
if not exist "dist-win\scripts" mkdir "dist-win\scripts"

echo 5. Empacotando executavel nativo Windows x64 com PKG...
call npx pkg dist-server/server.cjs --target node18-win-x64 --output dist-win\CIBERCOP-Gateway-V1.exe

echo 6. Copiando interface web e scripts para o pacote...
xcopy /E /I /Y "dist" "dist-win\dist" >nul
copy /Y "scripts\windows-firewall-setup.bat" "dist-win\scripts\" >nul
copy /Y "scripts\windows-firewall-setup.ps1" "dist-win\scripts\" >nul
if exist "data\gateway-config.json" copy /Y "data\gateway-config.json" "dist-win\data\" >nul

echo.
echo =======================================================
echo [CONCLUIDO COM SUCESSO]
echo Executavel Windows gerado em: dist-win\CIBERCOP-Gateway-V1.exe
echo Pasta com arquivos estaticos: dist-win\dist
echo Binario FFmpeg para HLS     : dist-win\bin\ffmpeg.exe
echo =======================================================
echo.
pause
