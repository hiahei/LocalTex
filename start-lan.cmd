@echo off
cd /d "%~dp0"
start "" powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0launch-localtex.ps1"
exit /b
