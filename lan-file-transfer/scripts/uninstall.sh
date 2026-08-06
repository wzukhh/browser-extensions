#!/bin/bash
set -e

echo ""
echo "  ============================================"
echo "   📁 LAN 文件传输 - Native Host 卸载"
echo "  ============================================"
echo ""

EXT_ID="ieaemhcnhkcapbjdlioehibecafmegca"

# Remove native messaging host manifests per platform
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
else
    echo "  ❌ 不支持的操作系统: $OSTYPE"
    exit 1
fi

REGISTERED=0
for DIR in "${HOST_DIRS[@]}"; do
    MANIFEST="$DIR/com.browserplugin.filetransfer.json"
    if [ -f "$MANIFEST" ]; then
        rm "$MANIFEST"
        echo "  ✅ 已移除: $MANIFEST"
        REGISTERED=$((REGISTERED + 1))
    fi
done

if [ "$REGISTERED" -eq 0 ]; then
    echo "  ℹ️  未找到已注册的 Native Host"
fi

# Remove binary
INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/lan-file-transfer"
if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    echo "  ✅ 已删除: $INSTALL_DIR"
else
    echo "  ℹ️  二进制目录不存在，跳过"
fi

echo ""
echo "  ============================================"
echo "   ✅ 卸载完成！"
echo "  ============================================"
echo ""
echo "   📌 提醒: 如果之前是开发者模式加载的扩展，"
echo "     请手动到 chrome://extensions 移除。"
echo ""
