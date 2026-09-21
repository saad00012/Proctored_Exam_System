@echo off
title Dnyanshree Exam App Launcher
echo ============================================================
echo      Dnyanshree Proctored Exam Portal  ^|  Desktop PC
echo ============================================================
echo.

:: ?? Detect Node.js / npm ?????????????????????????????????????????????????
set "NPM_CMD=npm"

:: Check common install paths on this machine
if exist "C:\Program Files\nodejs\npm.cmd"                   set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
if exist "C:\Program Files (x86)\nodejs\npm.cmd"             set "NPM_CMD=C:\Program Files (x86)\nodejs\npm.cmd"
if exist "%APPDATA%\npm\npm.cmd"                             set "NPM_CMD=%APPDATA%\npm\npm.cmd"
if exist "%LOCALAPPDATA%\Programs\nodejs\npm.cmd"            set "NPM_CMD=%LOCALAPPDATA%\Programs\nodejs\npm.cmd"

:: Verify npm is usable at all
where npm >nul 2>&1
if %errorlevel% equ 0 set "NPM_CMD=npm"

:: ?? 1. Start Backend ??????????????????????????????????????????????????????
echo [1/3] Starting Express Backend API  (Port 5000)...
start "Backend ^| Proctored Exam" /D "%~dp0backend" cmd /k "%NPM_CMD%" run dev
timeout /t 2 /nobreak >nul

:: ── 2. Start Dashboard ────────────────────────────────────────────────────
echo [2/3] Starting Teacher Dashboard  (Port 5173)...
start "Dashboard ^| Proctored Exam" /D "%~dp0dashboard" cmd /k "%NPM_CMD%" run dev
timeout /t 2 /nobreak >nul

:: ?? 3. ADB Port Forwarding ????????????????????????????????????????????????
echo [3/3] Checking ADB for Android device port forwarding...

:: Search common ADB locations
set "ADB_PATH="
if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" set "ADB_PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if exist "C:\Android\Sdk\platform-tools\adb.exe"             set "ADB_PATH=C:\Android\Sdk\platform-tools\adb.exe"
if exist "C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe" set "ADB_PATH=C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"

if defined ADB_PATH (
    echo ADB found. Forwarding device port 5000 to backend...
    "%ADB_PATH%" reverse tcp:5000 tcp:5000
    if %errorlevel% equ 0 (
        echo [OK] ADB port forwarding established!
    ) else (
        echo [WARNING] ADB failed. Make sure USB Debugging is ON and phone is connected.
    )
) else (
    echo [NOTICE] ADB ^(Android Debug Bridge^) not found on this PC.
    echo          Install Android Studio to get ADB, then run manually:
    echo            adb reverse tcp:5000 tcp:5000
    echo          OR connect the phone and run the app via Android Studio.
)

echo.
echo ============================================================
echo  Backend  ^>  http://localhost:5000
echo  Dashboard ^> http://localhost:5173
echo  Close these windows to stop all services.
echo ============================================================
echo.
pause
