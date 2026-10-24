$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$pidFile = Join-Path $PSScriptRoot 'data\localtex.pid'
$portableNode = (Resolve-Path (Join-Path $PSScriptRoot 'tools\node\node.exe')).Path

if (-not (Test-Path -LiteralPath $pidFile)) {
    Write-Host 'No LocalTeX service created by the launcher was found.' -ForegroundColor Yellow
    exit 0
}

$serviceId = [int](Get-Content -LiteralPath $pidFile -Raw)
$service = Get-Process -Id $serviceId -ErrorAction SilentlyContinue
if (-not $service) {
    Remove-Item -LiteralPath $pidFile -Force
    Write-Host 'The LocalTeX service is already stopped.' -ForegroundColor Green
    exit 0
}

if ($service.Path -ne $portableNode) {
    throw "PID $serviceId is not the LocalTeX portable Node.js process. Refusing to stop it."
}

Stop-Process -Id $serviceId
Wait-Process -Id $serviceId -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
Write-Host 'The LocalTeX service has stopped.' -ForegroundColor Green
