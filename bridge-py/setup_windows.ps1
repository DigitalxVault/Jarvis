# JARVIS Bridge - Windows Setup Script
# Run from the bridge-py/ directory:
#   powershell -ExecutionPolicy Bypass -File setup_windows.ps1

Write-Host "=== JARVIS Bridge Windows Setup ===" -ForegroundColor Cyan

# 1. Create generated directory
Write-Host "Creating generated/ directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path generated | Out-Null

# 2. Generate gRPC stubs from proto files
Write-Host "Generating gRPC stubs from proto files..." -ForegroundColor Yellow
uv run python -m grpc_tools.protoc `
    --proto_path=proto `
    --python_out=generated `
    --grpc_python_out=generated `
    --pyi_out=generated `
    dcs/common/v0/common.proto `
    dcs/mission/v0/mission.proto `
    dcs/unit/v0/unit.proto `
    dcs/hook/v0/hook.proto

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: protoc failed. Make sure you're in the bridge-py/ directory." -ForegroundColor Red
    exit 1
}

# 3. Create __init__.py files so Python can import the generated packages
Write-Host "Creating __init__.py files..." -ForegroundColor Yellow
$dirs = @(
    "generated",
    "generated\dcs",
    "generated\dcs\common",
    "generated\dcs\common\v0",
    "generated\dcs\mission",
    "generated\dcs\mission\v0",
    "generated\dcs\unit",
    "generated\dcs\unit\v0",
    "generated\dcs\hook",
    "generated\dcs\hook\v0"
)

foreach ($dir in $dirs) {
    $file = Join-Path $dir "__init__.py"
    if (-not (Test-Path $file)) {
        $null > $file
    }
}

# 4. Verify imports work
Write-Host "Verifying imports..." -ForegroundColor Yellow
uv run python -c "from jarvis_bridge.main import main; print('OK: main.py imports')"
uv run python -c "from jarvis_bridge.grpc_client import GrpcClient; print('OK: grpc_client.py imports')"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== Setup complete! ===" -ForegroundColor Green
    Write-Host "Run the bridge with:" -ForegroundColor Cyan
    Write-Host "  uv run jarvis-bridge" -ForegroundColor White
} else {
    Write-Host "ERROR: Import verification failed." -ForegroundColor Red
    exit 1
}
