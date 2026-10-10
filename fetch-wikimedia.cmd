@echo off
rem Photos of Pitt County's notable places from Wikimedia Commons (free, no account needed) into .cache\wikimedia\,
rem with contact sheets in .cache\wikimedia\sheets\ . Safe to re-run: it resumes.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org and run this again. & pause & exit /b 1)
node tools/notable-places.mjs > fetch-wikimedia.log 2>&1
node tools/fetch-wikimedia.mjs %* >> fetch-wikimedia.log 2>&1
python tools/mapillary-sheets.py --src wikimedia >> fetch-wikimedia.log 2>&1
type fetch-wikimedia.log
echo.
pause
