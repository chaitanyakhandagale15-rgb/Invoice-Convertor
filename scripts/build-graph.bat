@echo off
if not exist ".planning\graphs" mkdir .planning\graphs
graphify update .
if %errorlevel% neq 0 exit /b %errorlevel%

copy /Y graphify-out\graph.json .planning\graphs\graph.json >nul
copy /Y graphify-out\graph.html .planning\graphs\graph.html >nul
copy /Y graphify-out\GRAPH_REPORT.md .planning\graphs\GRAPH_REPORT.md >nul

node "%USERPROFILE%\.gemini\antigravity\get-shit-done\bin\gsd-tools.cjs" graphify build snapshot
if %errorlevel% neq 0 exit /b %errorlevel%

node "%USERPROFILE%\.gemini\antigravity\get-shit-done\bin\gsd-tools.cjs" graphify status
