# 📁 LAN 文件传输 - Chrome 扩展

> [English](./README.en.md) | 简体中文

扫码即可在电脑和手机之间互相传输文件，**所有数据仅在局域网内传输，不上传互联网**。

支持**多设备隔离**：多台手机可同时使用，每台设备只能看到自己的数据。

## 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/wzukhh/browser-extensions.git
cd browser-extensions/lan-file-transfer

# 2. 安装 Native Host（选择你的平台）
# macOS / Linux
bash scripts/install.sh

# Windows（双击或命令行执行）
scripts\install.bat

# 3. 加载 Chrome 扩展
#    打开 chrome://extensions → 开启「开发者模式」
#    → 点击「加载已解压的扩展程序」→ 选择 extension/ 目录

# 4. 点击 Chrome 工具栏的 📁 图标开始使用
```

> 扩展 ID 已通过 manifest.json 中的 key 固定为 `ieaemhcnhkcapbjdlioehibecafmegca`，所有机器一致，无需手动配置。

## 架构

```
点击扩展图标 → 启动 Go 本地服务 → 打开新标签页 → 显示二维码
                                                      ↓
                                             多台手机扫码 → 独立传输
```

| 模块 | 技术 |
|------|------|
| 扩展 | Manifest V3, Service Worker |
| 后端 | Go 1.21+, net/http, embed.FS |
| 前端 | 原生 HTML/CSS/JS, QRCode.js |
| 推送 | Server-Sent Events (SSE) |
| 传输 | HTTP multipart upload, 200MB/文件上限 |
| 安全 | 随机 token 验证，设备级隔离 |

## 功能特性

### 多设备隔离
- 手机首次扫码连接时设置设备名称
- 每台手机只能看到自己上传和电脑发给自己的文件
- 电脑端可查看所有设备，按设备筛选

### 电脑端（PC 布局）
```
┌─────────────┬──────────────────────────────┐
│   二维码     │  已连接的设备: 🟢 手机A 🟢 手机B│
│   URL 链接   │  发送到：[全部] [手机A] [手机B] │
│             │  ┌─上传按钮──────────────────┐ │
│             │  │ 已发送 | 已接收 [全部] [A] │ │
│             │  │ 文件列表...                │ │
│             │  └──────────────────────────┘ │
└─────────────┴──────────────────────────────┘
```
- **上传**：选择目标设备（多选），文件仅发送到选中设备
- **已发送**：查看发给各设备的历史，可按设备筛选
- **已接收**：查看各手机上传的文件，可按来源筛选

### 手机端
- 首次使用弹窗设置设备名称
- 设备名显示在页头，支持随时修改 ✏️
- "已发送"：只看本机上传的文件
- "已接收"：只看电脑发给自己的文件

### 数据隔离规则
| 场景 | 可见范围 |
|------|---------|
| 手机 A 上传 | 仅 PC 和手机 A 可见 |
| 手机 B 上传 | 仅 PC 和手机 B 可见 |
| PC 上传 + 指定设备 | 仅目标设备可见 |
| PC 上传（不指定） | 所有设备可见（广播） |

## 项目结构

```
lan-file-transfer/
├── src/                          # Go 源码 + 嵌入式前端
│   ├── main.go                   # 入口 + Native Messaging 协议
│   ├── server.go                 # HTTP 服务器 + 文件处理 + SSE
│   ├── go.mod                    # Go 模块（无外部依赖）
│   └── web/                      # 前端页面（通过 embed.FS 嵌入）
│       ├── index.html
│       ├── style.css
│       └── app.js
│
├── extension/                    # Chrome 扩展（开发时加载此目录）
│   ├── manifest.json             # MV3 清单（含固定 key）
│   ├── background.js             # Service Worker
│   ├── loading.html / .js        # 启动加载页
│   └── icons/                    # 图标 (16/48/128)
│
├── build/                        # 预编译的可执行文件（已提交到仓库）
│   ├── windows/
│   │   └── lan-file-transfer.exe
│   ├── macos/
│   │   ├── lan-file-transfer        # Apple Silicon
│   │   └── lan-file-transfer-intel  # Intel
│   └── linux/
│       └── lan-file-transfer
│
├── scripts/                      # 安装/卸载脚本
│   ├── install.sh                # macOS & Linux
│   ├── install.bat               # Windows
│   ├── uninstall.sh
│   └── uninstall.bat
│
├── key.pem                       # 扩展签名密钥
├── Makefile                      # 构建命令
├── native-host-template.json     # Native Host 清单模板
└── README.md
```

## 安装详解

### Native Host

安装脚本会自动：
- 从 `build/` 复制对应平台的二进制文件到系统目录
- 注册到所有已安装的 Chromium 内核浏览器（Chrome / Chromium / Brave / Edge）

如果 `build/` 中没有对应的预编译二进制，脚本会自动从源码编译。

### 二进制安装路径

| 平台 | 路径 |
|------|------|
| Windows | `%APPDATA%\LAN-File-Transfer\lan-file-transfer.exe` |
| macOS | `~/.local/share/lan-file-transfer/lan-file-transfer` |
| Linux | `~/.local/share/lan-file-transfer/lan-file-transfer` |

### 手动编译

```bash
# 编译当前平台
make build

# 编译所有平台
make build-all
```

## 使用

### 电脑端
1. 点击 Chrome 工具栏的扩展图标 📁
2. 二维码面板显示在左侧，下方有扫码 URL
3. 右侧设备面板显示已连接的手机
4. 选择目标设备（可多选），点击上传按钮发送文件
5. 使用"已发送/已接收"上方的设备筛选 pill 过滤文件

### 手机端
1. 扫码打开页面 → 首次使用设置设备名称
2. 点击页头的设备名 ✏️ 可改名
3. 上传文件：自动发到电脑（无需选择目标）
4. "已发送" Tab：本机上传的文件
5. "已接收" Tab：电脑发给本机的文件

### 双向传输
- 📱→💻：手机上选文件上传，电脑自动接收
- 💻→📱：电脑上选择目标设备发送，手机刷新后下载

## 开发模式

无需安装 Chrome 扩展即可测试 HTTP 服务器：

```bash
cd lan-file-transfer/src
go run . --serve

# 或在项目根目录：
cd lan-file-transfer && go run ./src --serve
```

浏览器打开显示的地址即可使用全部功能。

## 卸载

```bash
# macOS / Linux
bash scripts/uninstall.sh

# Windows
scripts\uninstall.bat
```

然后到 `chrome://extensions` 手动移除扩展。

## 跨平台支持

Windows / macOS (Intel + Apple Silicon) / Linux
