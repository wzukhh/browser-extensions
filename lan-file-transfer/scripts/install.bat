@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

title LAN 文件传输 - 安装 Native Host

echo.
echo  ============================================
echo   📁 LAN 文件传输 - Native Host 安装
echo  ============================================
echo.

set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "PROJECT_DIR=%SCRIPT_DIR%\.."

:: 扩展 ID（由 key.pem 固定，加载扩展后自动匹配）
set "EXT_ID=ieaemhcnhkcapbjdlioehibecafmegca"

:: 查找 pre-built 二进制文件
set "BINARY=%PROJECT_DIR%\build\windows\lan-file-transfer.exe"

if not exist "%BINARY%" (
    echo   ❌ 错误: 未找到预编译的二进制文件
    echo     预期位置: %BINARY%
    echo.
    echo     请先编译:
    echo       cd %PROJECT_DIR% ^&^& make build-all
    echo     或仅编译 Windows:
    echo       cd %PROJECT_DIR%\src ^&^& go build -o ..\build\windows\lan-file-transfer.exe .
    echo.
    pause
    exit /b 1
)

echo   ✅ 找到 lan-file-transfer.exe
echo   🆔 扩展 ID: %EXT_ID%
echo.

:: 创建配置目录
set "CONFIG_DIR=%APPDATA%\LAN-File-Transfer"
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

:: 复制 exe 到配置目录
copy /Y "%BINARY%" "%CONFIG_DIR%\lan-file-transfer.exe" >nul
echo   ✅ Native Host 已复制到 %CONFIG_DIR%

:: 生成 manifest.json
set "MANIFEST=%CONFIG_DIR%\com.browserplugin.filetransfer.json"
(
echo {
echo   "name": "com.browserplugin.filetransfer",
echo   "description": "LAN File Transfer Native Host",
echo   "path": "%CONFIG_DIR:\=\\%\\lan-file-transfer.exe",
echo   "type": "stdio",
echo   "allowed_origins": ["chrome-extension://%EXT_ID%/"]
echo }
) > "%MANIFEST%"

echo   ✅ Manifest 已生成

:: 注册到 Chrome
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.browserplugin.filetransfer" /ve /t REG_SZ /d "%MANIFEST%" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✅ Chrome 注册成功
) else (
    echo   ⚠️  Chrome 注册失败，请以管理员身份运行
)

:: 也注册到 Edge
reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.browserplugin.filetransfer" /ve /t REG_SZ /d "%MANIFEST%" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✅ Edge 注册成功
)

echo.
echo  ============================================
echo   ✅ 安装完成！
echo  ============================================
echo.
echo   📌 接下来:
echo     1. 打开 Chrome → chrome://extensions
echo     2. 开启「开发者模式」→ 「加载已解压的扩展程序」
echo     3. 选择项目根目录下的 extension 文件夹
echo     4. 点击扩展图标 📁 即可使用
echo.
pause
