# Starts the local MongoDB instance used by Ledora.
# The database lives outside Program Files so it survives restarts and has
# write permission without admin rights.
$ErrorActionPreference = 'Stop'
$mongoBin = 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
$dbPath = 'C:\Users\Dell\ledora-mongo-data'
$logPath = Join-Path $dbPath 'mongod.log'

if (-not (Test-Path $mongoBin)) {
  Write-Host "MongoDB is not installed at $mongoBin"
  exit 1
}
if (-not (Test-Path $dbPath)) {
  New-Item -ItemType Directory -Path $dbPath -Force | Out-Null
}

Write-Host "Starting MongoDB on 127.0.0.1:27017 (data: $dbPath)"
& $mongoBin --dbpath $dbPath --logpath $logPath --port 27017 --bind_ip 127.0.0.1
