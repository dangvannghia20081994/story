$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "Khong tim thay 'python' trong PATH."
}

Write-Host ">>> Tao venv: $Root\.venv"
python -m venv .venv

$Activate = Join-Path $Root ".venv\Scripts\Activate.ps1"
if (-not (Test-Path $Activate)) {
    Write-Error "Khong tao duoc venv."
}
. $Activate

Write-Host ">>> pip install -r requirements.txt (co extra-index cho llama-cpp wheel CPU)"
python -m pip install -U pip wheel
$ExtraIndex = "https://pnnbao97.github.io/llama-cpp-python-v0.3.16/cpu/"
pip install -r requirements.txt --extra-index-url $ExtraIndex

Write-Host ">>> Kiem tra import"
python scripts/check_install.py

Write-Host ""
Write-Host "Xong. Kich hoat sau nay: .\.venv\Scripts\Activate.ps1"
