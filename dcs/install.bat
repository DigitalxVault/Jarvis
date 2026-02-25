@echo off
:: JARVIS DCS Export Script Installer
:: Detects DCS variant, handles TacView chain-loading

set "DCS_STABLE=%USERPROFILE%\Saved Games\DCS"
set "DCS_BETA=%USERPROFILE%\Saved Games\DCS.openbeta"
set "SCRIPT_DIR=%~dp0"

echo.
echo  ========================================
echo   JARVIS DCS Telemetry - Installer
echo  ========================================
echo.

:: Detect which DCS variant exists
if exist "%DCS_STABLE%\Scripts" (
    set "TARGET=%DCS_STABLE%\Scripts"
    echo Found DCS Stable at %DCS_STABLE%
) else if exist "%DCS_BETA%\Scripts" (
    set "TARGET=%DCS_BETA%\Scripts"
    echo Found DCS Open Beta at %DCS_BETA%
) else (
    echo ERROR: No DCS Saved Games folder found.
    echo Expected: %DCS_STABLE%\Scripts or %DCS_BETA%\Scripts
    echo.
    echo Make sure DCS has been launched at least once.
    pause
    exit /b 1
)

:: Copy jarvis_export.lua to target
copy "%SCRIPT_DIR%jarvis_export.lua" "%TARGET%\jarvis_export.lua"
if errorlevel 1 (
    echo ERROR: Failed to copy jarvis_export.lua
    pause
    exit /b 1
)
echo Copied jarvis_export.lua to %TARGET%

:: Check if Export.lua already exists (TacView, SRS, etc.)
if exist "%TARGET%\Export.lua" (
    :: Check if JARVIS dofile already present
    findstr /C:"jarvis_export" "%TARGET%\Export.lua" >nul 2>&1
    if errorlevel 1 (
        echo.
        echo Existing Export.lua found (TacView/SRS). Appending JARVIS loader...
        echo.>> "%TARGET%\Export.lua"
        echo -- JARVIS DCS Telemetry>> "%TARGET%\Export.lua"
        echo dofile(lfs.writedir()..'Scripts/jarvis_export.lua'^)>> "%TARGET%\Export.lua"
        echo JARVIS chain-loader appended to existing Export.lua
    ) else (
        echo JARVIS already registered in Export.lua — skipping.
    )
) else (
    :: No Export.lua — create one that loads jarvis_export.lua
    echo -- JARVIS DCS Telemetry> "%TARGET%\Export.lua"
    echo dofile(lfs.writedir()..'Scripts/jarvis_export.lua'^)>> "%TARGET%\Export.lua"
    echo Created Export.lua with JARVIS loader
)

echo.
echo Installation complete! Restart DCS to activate.
echo.
pause
