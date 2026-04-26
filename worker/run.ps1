param(
    # Không --reload: tránh WatchFiles restart giữa chừng khi job VieNeu/chunk dài đang chạy.
    [switch] $NoReload
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

$Uvicorn = Join-Path $Root ".venv\Scripts\uvicorn.exe"
if (-not (Test-Path $Uvicorn)) {
    Write-Error "Chua co .venv hoac uvicorn. Chay: python -m venv .venv; .\.venv\Scripts\pip install -r requirements.txt --extra-index-url https://pnnbao97.github.io/llama-cpp-python-v0.3.16/cpu/"
}

Write-Host "Worker Python:" (Join-Path $Root ".venv\Scripts\python.exe")
if ($NoReload) {
    Write-Host "Uvicorn: no --reload (WatchFiles off)"
    & $Uvicorn @("app.main:app", "--port", "8080")
} else {
    & $Uvicorn @("app.main:app", "--reload", "--port", "8080")
}
