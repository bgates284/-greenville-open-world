@echo off
rem Downloads what every building in Pitt County is made of (walls, roof, style, storeys) from the
rem county tax records into public-data\pittbld\ so the game can build each one from the right materials.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org and run this again. & pause & exit /b 1)
echo Downloading Pitt County building records (a few minutes)...
node tools/fetch-pitt-buildings.mjs %* > fetch-pitt-buildings.log 2>&1
type fetch-pitt-buildings.log
echo.
pause
