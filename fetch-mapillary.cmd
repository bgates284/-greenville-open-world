@echo off
rem Street-level photos of Pitt County's shops, restaurants, churches and other named buildings from Mapillary,
rem then contact sheets of them in .cache\mapillary\sheets\ . Needs your free Mapillary client token in
rem mapillary-token.txt (see the top of tools\fetch-mapillary.mjs). Safe to re-run: it resumes.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org and run this again. & pause & exit /b 1)
if not exist mapillary-token.txt (echo Put your Mapillary client token ^(starts with MLY^|^) in mapillary-token.txt in this folder first. & pause & exit /b 1)
node tools/fetch-mapillary.mjs %* > fetch-mapillary.log 2>&1
python tools/mapillary-sheets.py >> fetch-mapillary.log 2>&1
type fetch-mapillary.log
echo.
pause
