$ErrorActionPreference = 'Stop'

$addresses = ipconfig | Select-String 'IPv4' | ForEach-Object {
  if ($_.Line -match '(\d{1,3}(?:\.\d{1,3}){3})') { $Matches[1] }
}

$lanIp = $addresses | Where-Object { $_ -like '192.168.*' } | Select-Object -First 1
if (-not $lanIp) { $lanIp = $addresses | Where-Object { $_ -like '10.*' } | Select-Object -First 1 }
if (-not $lanIp) {
  $lanIp = $addresses | Where-Object {
    $_ -match '^172\.(1[6-9]|2[0-9]|3[01])\.' -and $_ -notlike '172.18.*'
  } | Select-Object -First 1
}
if (-not $lanIp) { throw 'No LAN IPv4 address was found.' }

$env:PUBLIC_URL = "http://${lanIp}:3000"
Write-Host "Mobile URL: $env:PUBLIC_URL" -ForegroundColor Green
docker compose up -d --build
