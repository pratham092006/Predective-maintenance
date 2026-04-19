param(
    [switch]$Rebuild
)

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

$composeArgs = @("compose", "up", "-d")
if ($Rebuild) {
    $composeArgs += "--build"
}

Write-Host "Starting Docker stack..." -ForegroundColor Cyan
& docker @composeArgs

Write-Host "Current compose status:" -ForegroundColor Cyan
& docker compose ps

Write-Host "Done. Backend: http://127.0.0.1:8000  UI: http://127.0.0.1:8000/ui" -ForegroundColor Green