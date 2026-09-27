@echo off
:: ============================================================================
:: CIBERCOP GATEWAY V1 - WINDOWS FIREWALL SETUP SCRIPT (LOCAL SUBNET ONLY)
:: Opens TCP 18902 ONLY for devices on the same local network (LocalSubnet/Wi-Fi/LAN)
:: Does NOT expose port to the public Internet.
:: Idempotent: safe to run multiple times without duplicating rules.
:: ============================================================================

echo.
echo ===========================================================================
echo   CIBERCOP GATEWAY - CONFIGURACAO DE SEGURANCA DO FIREWALL WINDOWS
echo ===========================================================================
echo.

:: Check for Administrative privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Este script requer permissoes de Administrador.
    echo Clique com o botao direito no arquivo e escolha "Executar como administrador".
    echo.
    pause
    exit /b 1
)

set RULE_NAME=CIBERCOP Gateway 18902 (Rede Local)
set PORT=18902
set EXE_PATH=%~dp0..\dist-win\CIBERCOP-Gateway-V1.exe
if not exist "%EXE_PATH%" set EXE_PATH=%~dp0CIBERCOP-Gateway-V1.exe

echo 1. Removendo regras anteriores para garantir idempotencia...
netsh advfirewall firewall delete rule name="%RULE_NAME%" >nul 2>&1

echo 2. Criando regra restrita exclusivamente a LOCAL SUBNET (Wi-Fi / LAN)...
if exist "%EXE_PATH%" (
    echo    Vinculando regra ao executavel: %EXE_PATH%
    netsh advfirewall firewall add rule name="%RULE_NAME%" dir=in action=allow protocol=TCP localport=%PORT% remoteip=LocalSubnet profile=private,domain program="%EXE_PATH%"
) else (
    netsh advfirewall firewall add rule name="%RULE_NAME%" dir=in action=allow protocol=TCP localport=%PORT% remoteip=LocalSubnet profile=private,domain
)

if %errorLevel% equ 0 (
    echo.
    echo [SUCESSO] Regra criada com seguranca!
    echo - Porta: TCP %PORT%
    echo - Escopo: Somente dispositivos da mesma REDE LOCAL (LocalSubnet)
    echo - Internet Externa: BLOQUEADA (nao exposto publicamente)
    echo - Perfis: Privado e Corporativo
    echo.
    echo O APK/PWA CIBERCOP na mesma rede agora pode acessar:
    echo http://[IP-DO-COMPUTADOR]:%PORT%/health
) else (
    echo.
    echo [FALHA] Erro ao registrar regra no Firewall do Windows.
)

echo.
pause
