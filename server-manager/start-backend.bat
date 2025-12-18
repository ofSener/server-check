@echo off
title Server Manager - Backend
cd /d "%~dp0backend"
echo Starting Backend on port 3500...
npm start
pause
