@echo off
echo =========================================
echo   Apex Monitor - Setup Auto-start
echo =========================================
echo.
echo This will add Apex Monitor to Task Scheduler
echo so it starts silently on login with no warnings.
echo.
echo [!] Run this as Administrator for best results.
echo.
pause

:: Get the directory this bat file lives in
set "SCRIPT_DIR=%~dp0"
set "EXE_PATH=%SCRIPT_DIR%apex-monitor.exe"

:: Check exe exists
if not exist "%EXE_PATH%" (
    echo [ERROR] apex-monitor.exe not found in:
    echo         %SCRIPT_DIR%
    echo Run build.bat first.
    pause
    exit /b 1
)

:: Delete old task if it exists
schtasks /delete /tn "ApexOLEDMonitor" /f >nul 2>&1

:: Create task: runs at login for current user, hidden, with highest privileges
schtasks /create /tn "ApexOLEDMonitor" /tr "\"%EXE_PATH%\"" /sc onlogon /delay 0000:10 /rl highest /f >nul

if %errorlevel% neq 0 (
    echo [ERROR] Failed to create task. Try running as Administrator.
    pause
    exit /b 1
)

echo.
echo =========================================
echo   Done! Apex Monitor will now start
echo   automatically and silently on login.
echo.
echo   To remove auto-start, run:
echo   schtasks /delete /tn "ApexOLEDMonitor" /f
echo =========================================
echo.

:: Ask if they want to start it now
set /p START="Start Apex Monitor now? (y/n): "
if /i "%START%"=="y" start "" "%EXE_PATH%"

pause
