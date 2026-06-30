param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================"
Write-Host " HSE Pro - One Click Startup"
Write-Host "========================================"
Write-Host ""

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host "[1/7] Checking Docker..."
docker --version | Out-Host

Write-Host "[2/7] Starting PostgreSQL database..."
docker compose up -d

Write-Host "[3/7] Checking root dependencies..."
if (-not $SkipInstall -and -not (Test-Path ".\node_modules")) {
  npm install
}

Write-Host "[4/7] Checking backend dependencies..."
Set-Location "$Root\backend"
if (-not $SkipInstall -and -not (Test-Path ".\node_modules")) {
  npm install
}

Write-Host "[5/7] Preparing Prisma..."
npx prisma generate
npx prisma migrate deploy

Write-Host "[6/7] Checking frontend dependencies..."
Set-Location "$Root\frontend"
if (-not $SkipInstall -and -not (Test-Path ".\node_modules")) {
  npm install
}

Write-Host "[7/7] Starting HSE app..."
Set-Location $Root

Write-Host ""
Write-Host "Frontend:     http://localhost:5173"
Write-Host "Backend API:  http://localhost:5000"
Write-Host "TV Display:   http://localhost:5000/tv"
Write-Host ""

npm run dev:all
