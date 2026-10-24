#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$ruleName = 'LocalTeX LAN Collaboration (Private TCP 4177)'
$portableNode = Join-Path $PSScriptRoot 'tools\node\node.exe'

if (-not (Test-Path -LiteralPath $portableNode)) {
    throw "Portable Node.js was not found at $portableNode"
}

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host 'The LocalTeX private-network firewall rule already exists.' -ForegroundColor Green
    exit 0
}

New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort 4177 `
    -Program $portableNode `
    -RemoteAddress LocalSubnet `
    -Profile Private | Out-Null

Write-Host 'LocalTeX can now accept TCP 4177 from the local subnet on private networks.' -ForegroundColor Green

$publicProfiles = Get-NetConnectionProfile | Where-Object {
    $_.NetworkCategory -eq 'Public' -and $_.IPv4Connectivity -ne 'Disconnected'
}
if ($publicProfiles) {
    Write-Warning 'An active network is marked Public. The private-only rule does not apply there.'
    Write-Host 'Only for a trusted home or office network, change that network to Private in Windows Settings.' -ForegroundColor Yellow
}
