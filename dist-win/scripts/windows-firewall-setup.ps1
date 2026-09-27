# ============================================================================
# CIBERCOP GATEWAY V1 - WINDOWS FIREWALL POWERSHELL SETUP (LOCAL SUBNET ONLY)
# Restricts TCP 18902 to devices on the same local subnet / Wi-Fi / LAN.
# Idempotent: safe to run multiple times without duplicating rules.
# ============================================================================

$RuleName = "CIBERCOP Gateway 18902 (Rede Local)"
$Port = 18902
$ExePath = Join-Path $PSScriptRoot "..\dist-win\CIBERCOP-Gateway-V1.exe"
if (-not (Test-Path $ExePath)) {
    $ExePath = Join-Path $PSScriptRoot "CIBERCOP-Gateway-V1.exe"
}

Write-Host "Verificando privilegios de Administrador..." -ForegroundColor Cyan

$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Este script precisa ser executado como Administrador no PowerShell."
    exit 1
}

Write-Host "1. Removendo regra anterior para idempotencia..." -ForegroundColor Yellow
Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule

Write-Host "2. Criando regra com escopo restrito a LOCAL SUBNET..." -ForegroundColor Yellow

$ruleParams = @{
    DisplayName     = $RuleName
    Direction       = "Inbound"
    LocalPort       = $Port
    Protocol        = "TCP"
    RemoteAddress   = "LocalSubnet"
    Profile         = @("Private", "Domain")
    Action          = "Allow"
    Description     = "Permite conexoes locais do APK/PWA CIBERCOP exclusivamente na mesma rede local/Wi-Fi (porta $Port)."
}

if (Test-Path $ExePath) {
    Write-Host "   Vinculando regra ao executavel: $ExePath" -ForegroundColor Cyan
    $ruleParams["Program"] = (Resolve-Path $ExePath).Path
}

New-NetFirewallRule @ruleParams | Out-Null

Write-Host "`n[SUCESSO] Porta TCP $Port liberada no Firewall do Windows!" -ForegroundColor Green
Write-Host "  - Escopo: LOCAL SUBNET (Somente mesma rede local / Wi-Fi)" -ForegroundColor White
Write-Host "  - Internet Externa: BLOQUEADA" -ForegroundColor White
Write-Host "  - Idempotencia: Garantida (sem regras duplicadas)" -ForegroundColor White
Write-Host "`nO Gateway esta pronto para conexao pelo APK/PWA via:" -ForegroundColor Cyan
Write-Host "http://[IP-LOCAL]:$Port/health`n" -ForegroundColor White
