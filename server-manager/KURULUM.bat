@echo off
chcp 65001 > nul
title Server Manager - Kurulum Sihirbazi

echo.
echo  ╔════════════════════════════════════════════╗
echo  ║                                            ║
echo  ║      SERVER MANAGER KURULUM SIHIRBAZI      ║
echo  ║                                            ║
echo  ╚════════════════════════════════════════════╝
echo.

:: Node.js kontrolü
where node > nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Node.js bulunamadi!
    echo.
    echo Lutfen Node.js kurun: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo Node.js bulundu, kurulum baslatiliyor...
echo.

node "%~dp0setup.js"

pause
