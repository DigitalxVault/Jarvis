@echo off
title JARVIS — DCS Co-Pilot
color 0B
cd /d "%~dp0"

echo.
echo   =============================================
echo    J.A.R.V.I.S — DCS Combat Co-Pilot
echo   =============================================
echo.

:: -----------------------------------------------
:: 1. Check DCS export script is installed
:: -----------------------------------------------
set "DCS_STABLE=%USERPROFILE%\Saved Games\DCS\Scripts"
set "DCS_BETA=%USERPROFILE%\Saved Games\DCS.openbeta\Scripts"

set "DCS_SCRIPTS="
if exist "%DCS_STABLE%\jarvis_export.lua" (
    set "DCS_SCRIPTS=%DCS_STABLE%"
) else if exist "%DCS_BETA%\jarvis_export.lua" (
    set "DCS_SCRIPTS=%DCS_BETA%"
)

if not defined DCS_SCRIPTS (
    echo   [!] JARVIS export script not found in DCS.
    echo       Running installer...
    echo.
    call "%~dp0dcs\install.bat"
    echo.
)

:: -----------------------------------------------
:: 2. Check Python / uv available
:: -----------------------------------------------
where uv >nul 2>&1
if errorlevel 1 (
    echo   [ERROR] uv not found. Install it:
    echo          https://docs.astral.sh/uv/getting-started/installation/
    echo.
    pause
    exit /b 1
)

:: -----------------------------------------------
:: 3. Install Python deps if needed
:: -----------------------------------------------
if not exist "%~dp0bridge-py\.venv" (
    echo   [*] First run — setting up Python environment...
    cd /d "%~dp0bridge-py"
    uv sync
    cd /d "%~dp0"
    echo   [OK] Environment ready.
    echo.
)

:: -----------------------------------------------
:: 4. Launch bridge (opens browser automatically)
:: -----------------------------------------------
echo   [*] Starting JARVIS bridge...
echo   [*] Dashboard will open in your browser.
echo   [*] Launch DCS and start a mission — JARVIS takes it from here.
echo.
echo   Press Ctrl+C to stop.
echo.
echo   =============================================
echo.

cd /d "%~dp0bridge-py"
uv run jarvis-bridge

:: If we get here, bridge exited
echo.
echo   [JARVIS] Bridge stopped.
pause
