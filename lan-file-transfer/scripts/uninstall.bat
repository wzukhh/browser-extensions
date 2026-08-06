@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

title LAN 文件传输 - 卸载 Native Host

echo.
echo  ============================================
echo   📁 LAN 文件传输 - Native Host 卸载
echo  ============================================
echo.

:: 删除 Chrome 注册表项
reg delete "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.browserplugin.filetransfer" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✅ Chrome 注册已移除
) else (
    echo   ℹ️  Chrome 未注册，跳过
)

:: 删除 Edge 注册表项
reg delete "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.browserplugin.filetransfer" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✅ Edge 注册已移除
) else (
    echo   ℹ️  Edge 未注册，跳过
)

:: 删除二进制文件目录
set "CONFIG_DIR=%APPDATA%\LAN-File-Transfer"
if exist "%CONFIG_DIR%" (
    rmdir /s /q "%CONFIG_DIR%"
    echo   ✅ 已删除 %CONFIG_DIR%
) else (
    echo   ℹ️  二进制目录不存在，跳过
)

echo.
echo  ============================================
echo   ✅ 卸载完成！
echo  ============================================
echo.
echo   📌 提醒: 如果之前是开发者模式加载的扩展，
echo     请手动到 chrome://extensions 移除。
echo.
pause
