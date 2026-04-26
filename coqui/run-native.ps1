$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Da tao coqui/.env tu .env.example"
}

if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $i = $line.IndexOf("=")
            if ($i -gt 0) {
                $k = $line.Substring(0, $i).Trim()
                $v = $line.Substring($i + 1).Trim().Trim('"')
                [Environment]::SetEnvironmentVariable($k, $v, "Process")
            }
        }
    }
}

$model = [Environment]::GetEnvironmentVariable("COQUI_MODEL", "Process")
if (-not $model) { $model = "tts_models/en/ljspeech/vits" }
$port = [Environment]::GetEnvironmentVariable("COQUI_PORT", "Process")
if (-not $port) { $port = "5002" }

$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"
$VenvPip = Join-Path $Root ".venv\Scripts\pip.exe"
$TtsServer = Join-Path $Root ".venv\Scripts\tts-server.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Host "Tao .venv (can Python 3.10+ trong PATH)..."
    & python -m venv .venv
    if (-not (Test-Path $VenvPython)) { Write-Error "Khong tao duoc .venv. Cai Python 3.10+ (python trong PATH) va thu lai." }
}

if (-not (Test-Path $TtsServer)) {
    Write-Host "Cai coqui-tts[server] + torch (CPU), lan dau co the lau)..."
    & $VenvPip install -U pip wheel
    & $VenvPip install -r (Join-Path $Root "requirements.txt")
}

Write-Host "Coqui native: model=$model port=$port"
Write-Host "Python:" $VenvPython
& $TtsServer @("--model_name", $model, "--port", $port, "--device", "cpu")
