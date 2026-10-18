# Installs or updates Eisu Kana for the current user.
#
#   irm https://raw.githubusercontent.com/yodai-hi/kanabiner-settings/main/windows/eisu-kana/install.ps1 | iex
#
# Downloads the latest eisu-kana.exe to %LOCALAPPDATA%\EisuKana and starts it.
# On start it registers itself to run at sign-in. Uninstall with:
#   & "$env:LOCALAPPDATA\EisuKana\eisu-kana.exe" --uninstall

$ErrorActionPreference = 'Stop'

$dir = Join-Path $env:LOCALAPPDATA 'EisuKana'
$exe = Join-Path $dir 'eisu-kana.exe'
$url = 'https://github.com/yodai-hi/kanabiner-settings/releases/latest/download/eisu-kana.exe'

New-Item -ItemType Directory -Force $dir | Out-Null

# Download next to the exe first so a failed download leaves the current version intact.
$download = "$exe.download"
Invoke-WebRequest $url -OutFile $download -UseBasicParsing
Unblock-File $download

# Stop the running instance so the exe can be replaced.
if (Test-Path $exe) {
    Start-Process $exe -ArgumentList '--uninstall' -Wait
    Get-Process eisu-kana -ErrorAction SilentlyContinue | Wait-Process -Timeout 5 -ErrorAction SilentlyContinue
}

Move-Item -Force $download $exe
Start-Process $exe

Write-Host "Installed Eisu Kana: $exe"
Write-Host 'Home = IME off / End = IME on. Starts automatically at sign-in.'
