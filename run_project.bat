@echo off
title Dnyanshree Exam App Launcher
echo ============================================================
echo      Launching Dnyanshree Proctored Exam Portal Tiers
echo ============================================================
echo.

:: 1. Start Backend API Server
echo [1/3] Launching Express Backend API Server (Port 5000)...
start "Proctored Exam Backend" /D "%~dp0backend" cmd /k npm run dev

:: 2. Start Teacher Web Dashboard
echo [2/3] Launching Teacher React Dashboard (Port 5173)...
start "Teacher Web Dashboard" /D "%~dp0dashboard" cmd /k npm run dev

:: 3. Run ADB Port Forwarding to physical device
echo [3/3] Checking connected Android devices and mapping port...
set "ADB_PATH=C:\Users\Omkar\AppData\Local\Android\Sdk\platform-tools\adb.exe"

if exist "%ADB_PATH%" (
    echo Forwarding device port 5000 to computer...
    "%ADB_PATH%" reverse tcp:5000 tcp:5000
    if %errorlevel% equ 0 (
        echo [OK] ADB Port Forwarding successfully established!
    ) else (
        echo [WARNING] ADB mapping failed. Make sure your Samsung phone is connected via USB and USB Debugging is enabled in Settings.
    )
) else (
    echo [WARNING] ADB executable not found at "%ADB_PATH%". If a physical phone is connected, please run 'adb reverse tcp:5000 tcp:5000' manually.
)

echo.
echo ============================================================
echo All services launched! You can close this windows at any time.
echo ============================================================
echo.
pause
