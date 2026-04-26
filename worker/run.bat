@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\uvicorn.exe" (
  echo Chua co .venv. Tao venv va cai dat theo worker\README.md
  exit /b 1
)
echo Worker Python: %CD%\.venv\Scripts\python.exe
if /I "%~1"=="noreload" (
  echo Uvicorn: no --reload ^(WatchFiles off^)
  ".venv\Scripts\uvicorn.exe" app.main:app --port 8080
) else (
  ".venv\Scripts\uvicorn.exe" app.main:app --reload --port 8080
)
