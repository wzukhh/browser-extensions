@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================
echo  Word to PDF Converter -- Installer
echo ============================================
echo.

set "SCRIPT_DIR=%~dp0"
set "INSTALL_DIR=%APPDATA%\Word2PDF-Converter"
set "HOST_NAME=com.browserplugin.word2pdf"

REM --- 1. Copy binary ---
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

set "BINARY_PATH=%SCRIPT_DIR%..\build\windows\word2pdf-converter.exe"
if not exist "%BINARY_PATH%" (
    echo [ERROR] Binary not found at: %BINARY_PATH%
    echo Run "make build-all" first, then retry.
    pause
    exit /b 1
)

copy /Y "%BINARY_PATH%" "%INSTALL_DIR%\word2pdf-converter.exe" >nul
echo [OK] Copied native host to %INSTALL_DIR%

REM --- 2. Write native messaging host manifest ---
set "MANIFEST_PATH=%INSTALL_DIR%\com.browserplugin.word2pdf.json"

> "%MANIFEST_PATH%" (
    echo {
    echo   "name": "%HOST_NAME%",
    echo   "description": "Word to PDF Converter Native Host",
    echo   "path": "%INSTALL_DIR:\=\\%\\word2pdf-converter.exe",
    echo   "type": "stdio",
    echo   "allowed_origins": ["chrome-extension://lcfjnnpibdelbejfdeflbifofcblhlnh/"]
    echo }
)
echo [OK] Created host manifest

REM --- 3. Register in Windows registry ---
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Chrome registry entry added
) else (
    echo [WARN] Chrome registry failed (try running as admin)
)

reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Edge registry entry added
) else (
    echo [WARN] Edge registry failed (Edge may not be installed)
)

echo.
echo ============================================
echo  Installation complete!
echo.
echo  Next steps:
echo   1. Open chrome://extensions
echo   2. Enable Developer Mode
echo   3. Load unpacked -- select the extension/ folder
echo   4. Click the extension icon to start
echo ============================================
pause
