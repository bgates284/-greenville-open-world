@echo off
rem Downloads railways, level crossings, bus routes and bus stops for Pitt County (OpenStreetMap)
rem into public-data\transit.json — trains and buses in the game run on these.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org and run this again. & pause & exit /b 1)
node tools/fetch-transit.mjs
