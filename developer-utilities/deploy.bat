@echo off
echo ==========================================
echo       Deploying to GitHub / Render / Hostinger
echo ==========================================
cd /d "%~dp0.."
git add .
set /p msg="Enter commit message: "
git commit -m "%msg%"
git push origin main
echo.
echo Changes pushed! Render and Hostinger will now auto-deploy your updates.
pause
