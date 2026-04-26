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

Write-Host ">>> pip install -r requirements.txt"
python -m pip install -U pip wheel
pip install -r requirements.txt

Write-Host ">>> Kiem tra import"
python scripts/check_install.py

Write-Host ""
Write-Host "Xong. Kich hoat sau nay: .\.venv\Scripts\Activate.ps1"
