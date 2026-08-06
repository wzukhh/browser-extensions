# Word → PDF 转换器

> [English](./README.en.md) | 简体中文

将 Word 文档批量转换为 PDF 的 Chrome/Edge 浏览器扩展。**仅支持 Windows 系统**（通过 COM 接口调用本地 Office/WPS）。

## 工作原理

浏览器插件本身无法直接调用 Office/WPS，因此通过 **Native Messaging** 启动一个 Go 本地桥梁：

```
点击扩展图标
    ↓
Service Worker → 打开 loading.html → 启动 Go 二进制
    ↓
Go 二进制：检测 Office/WPS → 启动内嵌 HTTP 服务器
    ↓
浏览器新标签页打开 Web UI
    ↓
选择源文件夹 → 选择目标文件夹 → 点击转换
    ↓
Go 通过 go-ole COM 接口调用 Office/WPS 逐文件转换
    ↓
SSE 实时推送进度 → Web UI 展示转换记录
    ↓
转换结束 → 展示成功/失败结果列表
```

## 环境要求

- **操作系统**: Windows 7 及以上
- **Office**: Microsoft Office 2007+ 或 WPS Office
- **浏览器**: Google Chrome 或 Microsoft Edge
- **Go 1.21+**（仅开发编译时需要，普通用户不需要）

## 快速开始

### 1. 下载 / 编译

```bash
# 方式一：使用预编译二进制（推荐）
# 从 build/windows/ 直接获取 word2pdf-converter.exe

# 方式二：自行编译（需在 Windows 或交叉编译环境）
cd src
GOOS=windows GOARCH=amd64 go build -o word2pdf-converter.exe .
```

### 2. 安装 Native Host

```bat
scripts\install.bat
```

安装脚本会：
1. 把二进制复制到 `%APPDATA%\Word2PDF-Converter\`
2. 写入 Native Messaging Host 清单文件
3. 添加 Chrome 和 Edge 的注册表项

### 3. 加载扩展

1. 打开 Chrome → `chrome://extensions`
2. 开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择 `extension/` 目录
5. 点击工具栏扩展图标开始使用

### 4. 卸载

```bat
scripts\uninstall.bat
```

## 目录结构

```
word2pdf-converter/
├── src/                       # Go 本地桥梁源码（Windows）
│   ├── main.go                # 入口 + Native Messaging 协议
│   ├── detector.go            # Office/WPS COM 检测
│   ├── converter.go           # 转换核心（go-ole COM 调用）
│   ├── server.go              # HTTP API + SSE 实时推送
│   ├── platform.go            # 文件夹选择、资源管理器打开
│   ├── cleanup.go             # 进程清理
│   ├── web_embed.go           # //go:embed 嵌入前端
│   ├── web/                   # 前端 Web UI
│   │   ├── index.html
│   │   ├── style.css
│   │   └── app.js
│   ├── go.mod / go.sum
├── extension/                 # 浏览器扩展
│   ├── manifest.json
│   ├── background.js
│   ├── loading.html / loading.js
│   └── icons/
├── scripts/
│   ├── install.bat
│   └── uninstall.bat
├── build/windows/             # 预编译二进制
├── key.pem                    # 扩展私钥（固定扩展 ID）
├── native-host-template.json
├── Makefile
└── README.md
```

## 使用说明

1. **选择源文件夹**：点击「选择文件夹」按钮，选择包含 .doc/.docx 文件的目录
2. **选择目标文件夹**：可选，不选时默认在源文件夹下创建 `word2pdf_output`
3. **开始转换**：点击「开始转换」，等待转换完成
4. **查看结果**：转换完成后点击「查看结果」，查看成功/失败列表
5. **打开输出文件夹**：点击「📂 打开输出文件夹」在资源管理器中打开

> ⚠️ 扩展运行期间请勿手动打开 WPS 或 Word 文档，否则退出扩展时这些进程会被一并关闭。

## 技术栈

- **后端**: Go 1.21+、[go-ole](https://github.com/go-ole/go-ole)（COM 接口）、golang.org/x/sys（Windows API）
- **前端**: Vanilla HTML/CSS/JS（无框架，嵌入 Go 二进制）
- **扩展**: Manifest V3、Native Messaging API
- **通信**: SSE (Server-Sent Events) 实时推送

## 开发踩坑

开发过程中的踩坑总结见 [`docs/word2pdf-dev-pitfalls.md`](../docs/word2pdf-dev-pitfalls.md)。

通用的 Chrome 扩展 + Go Native Service 开发指南见 [`docs/chrome-extension-go-native-service-guide.md`](../docs/chrome-extension-go-native-service-guide.md)。

## 许可

MIT
