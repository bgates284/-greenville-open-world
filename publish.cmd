@echo off
rem Pushes this project to GitHub; GitHub Actions then publishes it to GitHub Pages.
cd /d "%~dp0"
where git >nul 2>nul || (echo Git is not installed. Get it from https://git-scm.com and run this again. & pause & exit /b 1)
git config --global --add safe.directory "%CD:\=/%" >nul 2>nul
git push -u origin main || (echo. & echo Push failed - see the message above. & pause & exit /b 1)
for /f "delims=" %%u in (git remote get-url origin) do set REPO=%%u
set REPO=%REPO:.git=%
echo.
echo Pushed to %REPO%
echo Opening the Pages settings and the build page...
start "" "%REPO%/settings/pages"
start "" "%REPO%/actions"
pause
