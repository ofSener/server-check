@echo off
echo Starting Server Manager...
start "Backend" cmd /c "%~dp0start-backend.bat"
timeout /t 3 /nobreak > nul
start "Dashboard" cmd /c "%~dp0start-dashboard.bat"
echo.
echo Backend: http://localhost:3500
echo Dashboard: http://localhost:5173
echo.
echo Varsayilan giris: admin / admin123
