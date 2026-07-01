$ErrorActionPreference = "Stop"

Write-Host "`n========================================"
Write-Host " HSE Pro - Local PostgreSQL Startup"
Write-Host "========================================"

Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force

$pgService = Get-Service postgresql-x64-17 -ErrorAction SilentlyContinue
if (-not $pgService) {
  Write-Host "PostgreSQL service postgresql-x64-17 not found."
  exit 1
}

if ($pgService.Status -ne "Running") {
  Start-Service postgresql-x64-17
}

cd "C:\HSE\HSE_FULL\backend"
npx prisma migrate deploy

cd "C:\HSE\HSE_FULL"
npm run dev:all
