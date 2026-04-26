@echo off
setlocal
cd /d "%~dp0"
if not exist ".env" if exist ".env.example" copy /y ".env.example" ".env" >nul & echo Created coqui/.env from .env.example
echo Coqui TTS compose in: %CD%
docker compose pull
docker compose up
