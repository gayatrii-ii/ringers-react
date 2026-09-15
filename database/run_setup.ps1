# PowerShell Helper to start Ringer Database via Docker Compose
param(
    [switch]$Supabase,
    [switch]$Down
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

if ($Down) {
    if ($Supabase) {
        Write-Host "Stopping Supabase local instance..." -ForegroundColor Yellow
        npx supabase stop
    } else {
        Write-Host "Stopping PostgreSQL Docker container..." -ForegroundColor Yellow
        docker compose down
    }
    exit 0
}

if ($Supabase) {
    Write-Host "Checking if Docker is running..." -ForegroundColor Cyan
    docker info > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker daemon is not running. Please start Docker Desktop first."
        exit 1
    }
    Write-Host "Starting Supabase local stack..." -ForegroundColor Green
    npx supabase start
    Write-Host "Supabase Studio is available at: http://localhost:54323" -ForegroundColor Green
    Write-Host "PostgreSQL direct connection port: 54322" -ForegroundColor Green
} else {
    Write-Host "Checking if Docker is running..." -ForegroundColor Cyan
    docker info > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker daemon is not running. Please start Docker Desktop first."
        exit 1
    }
    Write-Host "Starting PostgreSQL 16 via Docker Compose..." -ForegroundColor Green
    docker compose up -d
    Write-Host "PostgreSQL is running at: localhost:5432" -ForegroundColor Green
    Write-Host "Database: ringer_db | User: ringer_user" -ForegroundColor Green
}
