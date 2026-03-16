@echo off
title JARVIS Bridge
cd /d "%~dp0"
echo.
echo   ============================================
echo     JARVIS Bridge - Connecting to dashboard...
echo   ============================================
echo.
uv run jarvis-bridge
pause
