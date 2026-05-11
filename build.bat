@echo off
echo =========================================
echo   Apex Monitor - Build EXE
echo =========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Download it from https://nodejs.org and run this script again.
    pause
    exit /b 1
)

echo [1/4] Installing dependencies...
call npm install
if %errorlevel% neq 0 ( echo [ERROR] npm install failed. & pause & exit /b 1 )

echo.
echo [2/4] Installing pkg (exe bundler)...
call npm install -g pkg
if %errorlevel% neq 0 ( echo [ERROR] pkg install failed. & pause & exit /b 1 )

echo.
echo [3/4] Building apex-monitor.exe...
echo       (bundles Node.js, tray binary and icon - may take a minute)
if not exist dist mkdir dist
call pkg . --no-console --output dist\apex-monitor.exe
if %errorlevel% neq 0 ( echo [ERROR] Build failed. & pause & exit /b 1 )

echo.
echo [4/4] Copying support files...
copy /y config.json dist\config.json >nul
copy /y icon.ico dist\icon.ico >nul
copy /y start-silent.vbs dist\start-silent.vbs >nul
copy /y setup-autostart.bat dist\setup-autostart.bat >nul

echo.
echo =========================================
echo   Done!
echo   Share the dist\ folder with your friend.
echo   dist\ contains:
echo     apex-monitor.exe   - the app
echo     start-silent.vbs   - launch with no flash (use for startup)
echo     config.json        - edit update speed here
echo     README.md
echo   To quit: right-click the tray icon - Quit
echo =========================================
echo.
pause
