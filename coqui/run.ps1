$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Da tao coqui/.env tu .env.example"
}
Write-Host "Coqui TTS compose trong:" (Get-Location)
docker compose pull
docker compose up
