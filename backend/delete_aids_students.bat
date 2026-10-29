@echo off
title Delete AIDS Students - Dnyanshree Proctored Exam
color 0C
echo ============================================================
echo   CAUTION: PERMANENTLY DELETING ALL AIDS ENROLLED STUDENTS
echo ============================================================
echo.
cd /d "%~dp0"
node scripts/delete_aids_students.js
echo.
echo ============================================================
echo   Execution finished. Press any key to close this window.
echo ============================================================
pause >nul
