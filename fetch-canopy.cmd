@echo off
rem Downloads real tree canopy heights for all of Pitt County (Meta/WRI 1 m canopy height map)
rem into public-data\canopy\ so the game can put trees where they really are. Safe to re-run: it resumes.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org and run this again. & pause & exit /b 1)
if not exist node_modules\geotiff\ ( echo Installing the GeoTIFF reader... & call npm install --no-audit --no-fund )
node tools/fetch-canopy.mjs %*
echo.
pause
