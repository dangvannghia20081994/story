@echo off
setlocal
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" worker_redis.py %*
  exit /b %ERRORLEVEL%
)
echo [worker-tts] Chua co .venv. Chay:
echo   python -m venv .venv
echo   .venv\Scripts\pip install -U pip
echo   .venv\Scripts\pip install -r requirements.txt
echo   run_worker_redis.cmd
exit /b 1
