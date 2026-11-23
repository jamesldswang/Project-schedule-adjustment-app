@echo off
setlocal EnableExtensions

echo ==================================================
echo   Project-schedule-adjustment-app - Local Launcher
echo ==================================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [1/2] Installing dependencies ^(npm install --legacy-peer-deps^)...
    call npm install --legacy-peer-deps
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
) else (
    echo [1/2] Dependencies ready ^(node_modules found^).
)

echo [2/2] Starting Vite server at http://localhost:3000/ ...
call npm run dev
