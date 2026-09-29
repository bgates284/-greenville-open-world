@echo off
rem Downloads the whole city map (a few big requests), packs it for the website, and publishes it.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org and run this again. & pause & exit /b 1)
node tools/fetch-city.mjs --city --pack || (echo. & echo Download stopped - see the message above. & pause & exit /b 1)
git add public-data
git -c core.autocrlf=false commit -q -m "Map squares for the whole city" && echo Committed the new map squares. || echo No new map squares to commit.
call publish.cmd
