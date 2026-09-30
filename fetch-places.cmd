@echo off
rem Downloads every restaurant and store in Pitt County (OpenStreetMap) and places the small-town
rem businesses from tools\places-listings.json by street address, into public-data\places.json.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org and run this again. & pause & exit /b 1)
node tools/fetch-places.mjs
