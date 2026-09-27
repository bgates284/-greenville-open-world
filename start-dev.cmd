@echo off
rem Double-click to start the game with live reloading (installs Vite the first time).
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org and run this again. & pause & exit /b 1)
if not exist node_modules\vite (
  echo Installing Vite ^(first run only^)...
  call npm install || (pause & exit /b 1)
)
call npm run dev
pause
