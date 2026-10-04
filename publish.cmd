@echo off
rem Pushes this project to GitHub; GitHub Actions then publishes it to GitHub Pages.
cd /d "%~dp0"
where git >nul 2>nul || (echo Git is not installed. Get it from https://git-scm.com and run this again. & pause & exit /b 1)
git config --global --get-all safe.directory | findstr /x /c:"%CD:\=/%" >nul 2>nul || git config --global --add safe.directory "%CD:\=/%"
rem Use the bgates284 GitHub login so the account picker doesn't pop up (it tends to hide behind this window).
git config credential.https://github.com.username bgates284

rem If work is on another branch, bring main up to it first (fast-forward only, never overwrites main).
for /f "delims=" %%b in ('git branch --show-current') do set "BR=%%b"
if /i not "%BR%"=="main" (
  git merge-base --is-ancestor main HEAD || (echo main has commits that %BR% doesn't. Merge them by hand, then run this again. & pause & exit /b 1)
  echo Moving main up to %BR%...
  git branch -f main HEAD || (pause & exit /b 1)
  git checkout -q main || (pause & exit /b 1)
)

git push -u origin main && goto pushed
echo.
echo First push attempt failed - trying once more...
timeout /t 3 /nobreak >nul
git push -u origin main || (echo. & echo Push failed - see the message above. & pause & exit /b 1)

:pushed
for /f "delims=" %%u in ('git remote get-url origin') do set "REPO=%%u"
set "REPO=%REPO:.git=%"
echo.
echo Pushed to %REPO%
echo Opening the build page...
start "" "%REPO%/actions"
pause
