@echo off
cd /d "%~dp0"
echo ============================================
echo   Daily Panel  /  Local Server
echo   http://127.0.0.1:8765/index.html
echo   Press Ctrl+C in this window to stop
echo ============================================
start "" http://127.0.0.1:8765/index.html
"C:\Users\wangw\.workbuddy\binaries\python\versions\3.13.12\python.exe" -m http.server 8765 --bind 127.0.0.1
if errorlevel 1 (
  echo managed python failed, try system python...
  python -m http.server 8765 --bind 127.0.0.1
)
pause
