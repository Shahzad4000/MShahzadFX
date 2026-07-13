@echo off
REM Nexus AI - one-click Windows installer
REM Double-click this file on your Windows PC / VPS

echo ============================================
echo   Nexus AI - MT5 Bridge Installer
echo ============================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python nahi mila. Install karo: https://www.python.org/downloads/
    echo Install karte waqt "Add Python to PATH" tick karna.
    pause
    exit /b 1
)

echo [1/3] Python mil gaya.
python --version
echo.

echo [2/3] Dependencies install kar raha hu...
python -m pip install --upgrade pip
python -m pip install MetaTrader5 requests pandas feedparser
if errorlevel 1 (
    echo [ERROR] Install fail. Internet check karo.
    pause
    exit /b 1
)
echo.

echo [3/3] config.py check...
if not exist config.py (
    echo [ERROR] config.py nahi mila is folder me.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Setup complete!
echo ============================================
echo.
echo Ab bot chalane ke liye: run.bat double-click karo
echo Ya CMD me: python main.py
echo.
pause