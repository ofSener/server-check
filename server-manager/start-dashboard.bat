@echo off
title Server Manager - Dashboard
cd /d "%~dp0dashboard"
echo Starting Dashboard on port 5173...
npm run dev
pause
