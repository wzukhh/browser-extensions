@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================
echo  Word to PDF Converter -- Uninstaller
echo ============================================
echo.

set "INSTALL_DIR=%APPDATA%\Word2PDF-Converter"
set "HOST_NAME=com.browserplugin.word2pdf"

REM --- 1. Remove registry keys ---
reg delete "HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%" /f >nul 2>&1
echo [OK] Chrome registry entry removed

reg delete "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\%HOST_NAME%" /f >nul 2>&1
echo [OK] Edge registry entry removed

REM --- 2. Delete install directory ---
if exist "%INSTALL_DIR%" (
    rmdir /S /Q "%INSTALL_DIR%"
    echo [OK] Removed %INSTALL_DIR%
)

echo.
echo Uninstall complete.
pause
