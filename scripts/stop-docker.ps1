$ErrorActionPreference = "Stop"

Set-Location -Path (Join-Path $PSScriptRoot "..")

$dockerBin = "C:\Program Files\Docker\Docker\resources\bin"
if (Test-Path $dockerBin) {
    if (-not ($env:PATH -split ";" | Where-Object { $_ -eq $dockerBin })) {
        $env:PATH = "$dockerBin;$env:PATH"
    }
}

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    throw "Docker CLI not found. Install Docker Desktop or add Docker to PATH."
}

Write-Host "Stopping Docker stack..." -ForegroundColor Cyan
& docker compose down

Write-Host "Done. Containers stopped." -ForegroundColor Green
