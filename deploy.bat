@echo off
echo ==========================================
echo       Deploying to GitHub / Render
echo ==========================================
git add .
set /p msg="Enter commit message: "
git commit -m "%msg%"
git push origin main
echo.
echo Changes pushed! Render will now auto-deploy your updates.
pause