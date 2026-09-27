@echo off
rem Pushes this project to GitHub; GitHub Actions then publishes it to GitHub Pages.
cd /d "%~dp0"
where git >nul 2>nul || (echo Git is not installed. Get it from https://git-scm.com and run this again. & pause & exit /b 1)
git config --global --add safe.directory "%CD:\=/%" >nul 2>nul
git push -u origin main || (echo. & echo Push failed - see the message above. & pause & exit /b 1)
echo.
echo Pushed. Opening the Pages settings and the build page...
start "" "https://github.com/bgates284/greenville-open-world/settings/pages"
start "" "https://github.com/bgates284/greenville-open-world/actions"
pause
