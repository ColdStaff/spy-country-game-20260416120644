$workdir = Split-Path -Parent $MyInvocation.MyCommand.Path
$cloudflaredExe = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$serverOut = Join-Path $workdir 'server.out.log'
$serverErr = Join-Path $workdir 'server.err.log'
$tunnelOut = Join-Path $workdir 'tunnel.out.log'
$tunnelErr = Join-Path $workdir 'tunnel.err.log'
$pidFile = Join-Path $workdir '.hosting-pids.json'

if (-not (Test-Path $cloudflaredExe)) {
  Write-Error "cloudflared не найден: $cloudflaredExe"
  exit 1
}

Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

foreach ($f in @($serverOut,$serverErr,$tunnelOut,$tunnelErr,$pidFile)) { if (Test-Path $f) { Remove-Item $f -Force } }

$server = Start-Process -FilePath node -ArgumentList 'server.js' -WorkingDirectory $workdir -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr -PassThru
Start-Sleep -Seconds 2

$resp = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 10
if ($resp.StatusCode -ne 200) { throw 'Локальный сервер не поднялся.' }

$tunnel = Start-Process -FilePath $cloudflaredExe -ArgumentList @('tunnel','--url','http://localhost:3000','--no-autoupdate') -WorkingDirectory $workdir -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelErr -PassThru

$publicUrl = $null
for ($i = 0; $i -lt 120; $i++) {
  Start-Sleep -Milliseconds 500
  $combined = ''
  if (Test-Path $tunnelOut) { $combined += (Get-Content $tunnelOut -Raw -ErrorAction SilentlyContinue) + "`n" }
  if (Test-Path $tunnelErr) { $combined += (Get-Content $tunnelErr -Raw -ErrorAction SilentlyContinue) + "`n" }
  $match = [regex]::Match($combined, 'https://[-a-z0-9]+\.trycloudflare\.com')
  if ($match.Success) { $publicUrl = $match.Value; break }
}

if (-not $publicUrl) {
  Write-Error 'Не удалось получить публичный URL.'
  exit 1
}

$data = [ordered]@{
  startedAt = (Get-Date).ToString('s')
  serverPid = $server.Id
  tunnelPid = $tunnel.Id
  localUrl = 'http://localhost:3000'
  publicUrl = $publicUrl
}
$data | ConvertTo-Json | Set-Content -Encoding UTF8 $pidFile

Write-Output "PUBLIC_URL=$publicUrl"
Write-Output "SERVER_PID=$($server.Id)"
Write-Output "TUNNEL_PID=$($tunnel.Id)"
