$workdir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $workdir '.hosting-pids.json'

if (Test-Path $pidFile) {
  try {
    $json = Get-Content $pidFile -Raw | ConvertFrom-Json
    if ($json.serverPid) { Stop-Process -Id $json.serverPid -Force -ErrorAction SilentlyContinue }
    if ($json.tunnelPid) { Stop-Process -Id $json.tunnelPid -Force -ErrorAction SilentlyContinue }
  } catch {
    # ignore parse errors
  }
}

Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Output 'Public hosting stopped.'
