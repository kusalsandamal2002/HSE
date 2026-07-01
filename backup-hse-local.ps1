$ErrorActionPreference = "Stop"

$root = "C:\HSE\HSE_FULL"
$envPath = Join-Path $root "backend\.env"
$backupDir = Join-Path $root "backups\postgres"
$logPath = Join-Path $backupDir "backup.log"

New-Item -ItemType Directory -Force $backupDir | Out-Null

function Write-BackupLog {
  param([string]$Message)
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Message"
  Write-Host $line
  Add-Content -Path $logPath -Value $line
}

Write-BackupLog "Backup started."

$pgService = Get-Service postgresql-x64-17 -ErrorAction SilentlyContinue
if (-not $pgService) {
  throw "PostgreSQL service postgresql-x64-17 not found."
}

if ($pgService.Status -ne "Running") {
  Start-Service postgresql-x64-17
  Start-Sleep -Seconds 3
}

$dbUrlLine = Get-Content $envPath | Where-Object { $_ -match "^DATABASE_URL=" } | Select-Object -First 1
if (-not $dbUrlLine) {
  throw "DATABASE_URL not found in backend\.env"
}

$dbUrl = ($dbUrlLine -replace "^DATABASE_URL=", "").Trim().Trim('"')
$uri = [System.Uri]$dbUrl

$userParts = $uri.UserInfo.Split(":", 2)
$dbUser = [System.Uri]::UnescapeDataString($userParts[0])
$dbPassword = if ($userParts.Count -gt 1) { [System.Uri]::UnescapeDataString($userParts[1]) } else { "" }
$dbHost = $uri.Host
$dbPort = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
$dbName = $uri.AbsolutePath.TrimStart("/")

$pgDump = "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
if (-not (Test-Path $pgDump)) {
  $cmd = Get-Command pg_dump.exe -ErrorAction SilentlyContinue
  if ($cmd) {
    $pgDump = $cmd.Source
  } else {
    throw "pg_dump.exe not found."
  }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $backupDir "hse-pro-$stamp.dump"

$env:PGPASSWORD = $dbPassword

try {
  & $pgDump -h $dbHost -p $dbPort -U $dbUser -d $dbName -Fc -f $backupFile

  if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed with exit code $LASTEXITCODE"
  }

  $fileInfo = Get-Item $backupFile
  if ($fileInfo.Length -le 0) {
    throw "Backup file was created but is empty."
  }

  Write-BackupLog "Backup created: $backupFile Size=$($fileInfo.Length) bytes"

  Get-ChildItem $backupDir -Filter "hse-pro-*.dump" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
    Remove-Item -Force

  Write-BackupLog "Old backups older than 30 days cleaned."
  Write-BackupLog "Backup completed successfully."
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
