@echo off
cd /d "%~dp0"
node tools/fetch-wikimedia.mjs --places .cache\nrhp-places.json > fetch-wikimedia-nrhp.log 2>&1
