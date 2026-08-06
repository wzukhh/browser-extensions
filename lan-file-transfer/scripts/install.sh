#!/bin/bash
set -e

echo ""
echo "  ============================================"
echo "   📁 LAN 文件传输 - Native Host 安装"
echo "  ============================================"
echo ""

EXT_ID="ieaemhcnhkcapbjdlioehibecafmegca"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Pick the correct binary for the current platform/architecture
BINARY=""
if [[ "$OSTYPE" == "darwin"* ]]; then
    BUILD_DIR="$PROJECT_DIR/build/macos"
    ARCH="$(uname -m)"
    if [ "$ARCH" = "arm64" ]; then
        BINARY="$BUILD_DIR/lan-file-transfer"
    elif [ "$ARCH" = "x86_64" ]; then
        BINARY="$BUILD_DIR/lan-file-transfer-intel"
    else
        echo "  ❌ 不支持的架构: $ARCH"
        exit 1
    fi
elif [[ "$OSTYPE" == "linux"* ]]; then
    BUILD_DIR="$PROJECT_DIR/build/linux"
    BINARY="$BUILD_DIR/lan-file-transfer"
else
    echo "  ❌ 不支持的操作系统: $OSTYPE"
    exit 1
fi

# Check for pre-built binary
if [ ! -f "$BINARY" ]; then
    echo "  ❌ 未找到预编译的二进制文件: $BINARY"
    echo ""
    echo "     请先编译或下载:"
    echo "       cd $PROJECT_DIR && make build-all"
    echo "     或仅编译当前平台:"
    echo "       cd $PROJECT_DIR/src && go build -o $BINARY ."
    echo ""
    exit 1
fi

# Determine install directory per platform convention
if [[ "$OSTYPE" == "darwin"* || "$OSTYPE" == "linux"* ]]; then
    INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/lan-file-transfer"
fi
mkdir -p "$INSTALL_DIR"
cp "$BINARY" "$INSTALL_DIR/lan-file-transfer"
chmod +x "$INSTALL_DIR/lan-file-transfer"
echo "  ✅ 已复制到 $INSTALL_DIR/lan-file-transfer"

# Determine native messaging hosts directories per platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    HOST_DIRS=(
        "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
        "$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
        "$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
        "$HOME/Library/Application Support/Edge/NativeMessagingHosts"
    )
elif [[ "$OSTYPE" == "linux"* ]]; then
    HOST_DIRS=(
        "$HOME/.config/google-chrome/NativeMessagingHosts"
        "$HOME/.config/chromium/NativeMessagingHosts"
        "$HOME/.config/brave/NativeMessagingHosts"
        "$HOME/.config/microsoft-edge/NativeMessagingHosts"
    )
fi

BINARY_PATH="$INSTALL_DIR/lan-file-transfer"
MANIFEST=$(cat <<EOF
{
  "name": "com.browserplugin.filetransfer",
  "description": "LAN File Transfer Native Host",
  "path": "${BINARY_PATH}",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://${EXT_ID}/"]
}
EOF
)

REGISTERED=0
for DIR in "${HOST_DIRS[@]}"; do
    mkdir -p "$DIR"
    echo "$MANIFEST" > "$DIR/com.browserplugin.filetransfer.json"
    REGISTERED=$((REGISTERED + 1))
done
echo "  ✅ 已注册 $REGISTERED 个浏览器"

echo ""
echo "  ============================================"
echo "   ✅ 安装完成！"
echo "  ============================================"
echo ""
echo "   📌 接下来:"
echo "     1. 打开 Chrome → chrome://extensions"
echo "     2. 开启「开发者模式」→「加载已解压的扩展程序」"
echo "     3. 选择项目根目录下的 extension 文件夹"
echo "     4. 点击扩展图标 📁 即可使用"
echo ""
