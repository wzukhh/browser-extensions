# Chrome 扩展 + Go Native Service 开发指南

本文档总结本仓库中 **word2pdf-converter** 与 **lan-file-transfer** 两个插件的共性架构与最佳实践，可作为新插件的开发模板。

## 1. 适用场景

浏览器扩展无法直接访问本地文件系统、COM 接口或局域网设备。通过 **Native Messaging** 启动 Go 本地服务作为桥梁，再由内嵌 HTTP 服务器提供 Web UI。

```
用户点击扩展图标
    ↓
Service Worker 立即打开 loading.html
    ↓ connectNative() 启动 Go 进程
Go Native Host（stdio 协议）
    ↓ 启动内嵌 HTTP 服务器，回传 { url, token }
loading.html 轮询 SW 拿到 URL → 跳转 Web UI
    ↓
Web UI 通过 HTTP API + SSE 与 Go 交互
    ↓
Go 调用 COM / 文件系统 / 局域网服务
    ↓
关闭 tab / 发送 stop / 空闲超时 → 进程退出
```

## 2. 仓库内参考项目

| 维度 | word2pdf-converter | lan-file-transfer |
|------|-------------------|-------------------|
| 用途 | 本地 Word → PDF 批量转换 | 局域网多设备文件互传 |
| 平台 | **仅 Windows**（COM） | Windows / macOS / Linux |
| HTTP 绑定 | `127.0.0.1:0`（仅本机） | `:0`（局域网可访问） |
| 安全模型 | token + Origin/Referer 校验（写操作）+ 仅本机监听 | token + 设备凭证（`deviceId`/`deviceSecret`）+ CORS `*`；PC 管理接口仅本机 |
| 实时推送 | POST + SSE 流式响应 | GET SSE `/api/events` |
| 空闲退出 | 10 分钟无 HTTP 活动 | 10 分钟无 HTTP 活动 |
| Native 协议 | 首条消息 `start-converter`，退出 `stop`，就绪 `converter-started` | 进程启动即开服，退出 `stop-server`，就绪 `server-started` |

详细踩坑见 [`word2pdf-dev-pitfalls.md`](./word2pdf-dev-pitfalls.md)。

## 3. 技术选型

| 组件 | 推荐 | 说明 |
|------|------|------|
| 本地语言 | Go 1.21+ | 单文件分发，`//go:embed` 嵌入前端 |
| COM（Windows） | `github.com/go-ole/go-ole` | Office/WPS/Shell 自动化 |
| 系统 API | `golang.org/x/sys/windows` | 进程枚举等 |
| 前端 | Vanilla HTML/CSS/JS | 无构建工具链，全部 embed 进二进制 |
| 实时通信 | SSE（Server-Sent Events） | 单向推送，比 WebSocket 轻量 |
| 扩展 | Manifest V3 | Chrome / Edge 当前标准 |

## 4. 项目结构模板

```
my-plugin/
├── src/                          # Go 源码
│   ├── main.go                   # 入口：Native Messaging + 生命周期
│   ├── server.go                 # HTTP API + 鉴权 + SSE
│   ├── web_embed.go              # //go:embed web/*
│   ├── web/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── app.js
│   ├── go.mod / go.sum
│   └── …                         # 平台/业务逻辑（converter.go 等）
├── extension/                    # 浏览器扩展
│   ├── manifest.json             # 含固定 key
│   ├── background.js             # Service Worker
│   ├── loading.html / loading.js # 启动加载页（★ 必备）
│   └── icons/
├── build/                        # 预编译 native 二进制（按平台分目录）
├── scripts/
│   ├── install.bat / install.sh
│   └── uninstall.bat / uninstall.sh
├── native-host-template.json
├── key.pem                       # 扩展签名私钥（固定扩展 ID）
├── Makefile
└── README.md
```

## 5. 生命周期设计

### 5.1 启动

**扩展侧**：点击图标 → 立即打开 `loading.html` → `connectNative()` → 等待 Go 回传 URL。

**Go 侧**（两种模式，二选一）：

| 模式 | 说明 | 示例 |
|------|------|------|
| **等待首条消息** | 读 stdin 收到 `start-xxx` 后才开始工作 | word2pdf |
| **进程启动即开服** | `main()` 直接 Listen + 写 `server-started` | lan-file-transfer |

无论哪种，都应通过 stdout 告知扩展完整 URL（**含 token**）。仅本机工具使用 `127.0.0.1` URL；LAN 工具需要同时在 Web UI 中提供局域网访问地址或二维码：

```go
writeNativeMessage(map[string]interface{}{
    "type": "server-started", // 或 "converter-started"
    "url":  fmt.Sprintf("http://127.0.0.1:%d/?token=%s", port, token),
    "token": token,
})
```

### 5.2 运行

- Web UI 从 URL query 读取 `token`，所有 API 携带 `Authorization: Bearer <token>`
- 每次鉴权通过的 HTTP 请求重置空闲计时器（见 §6.4）
- 长任务（转换、SSE 流）期间在进度回调里也要 `bumpIdle()`

### 5.3 退出

| 触发条件 | 行为 |
|----------|------|
| 用户关闭扩展打开的 tab | SW 发送 `stop` / `stop-server`，断开 port |
| stdin 关闭（扩展 disconnect） | Go 主循环退出 |
| 空闲超时（默认 10 分钟） | 关闭 listener，进程退出 |
| SIGINT / SIGTERM | 同上 |

**前端**：服务不可达时展示「服务已退出，请重新点击扩展图标」视图，不要无限重连。

## 6. Native Messaging 协议

### 6.1 帧格式

4 字节小端 uint32 长度 + JSON payload：

```go
const maxNativeMessageSize = 1024 * 1024 // 1 MB，必须限制

func readMessage(r io.Reader) ([]byte, error) {
    var length uint32
    if err := binary.Read(r, binary.LittleEndian, &length); err != nil {
        return nil, err
    }
    if length > maxNativeMessageSize {
        return nil, fmt.Errorf("消息超长: %d", length)
    }
    data := make([]byte, length)
    _, err := io.ReadFull(r, data)
    return data, err
}

func writeMessage(v interface{}) error {
    data, err := json.Marshal(v)
    if err != nil {
        return err
    }
    header := make([]byte, 4)
    binary.LittleEndian.PutUint32(header, uint32(len(data)))
    if _, err := os.Stdout.Write(header); err != nil {
        return err
    }
    _, err = os.Stdout.Write(data)
    return err
}
```

### 6.2 扩展 ↔ Go 消息约定

保持**最小协议**，只保留 Go 侧明确处理的类型。不要在扩展侧发送无 Go 处理逻辑的消息。

```
扩展 → Go
  start-xxx          可选；等待首条消息模式才需要，例如 word2pdf 的 start-converter
  stop / stop-server     请求退出

Go → 扩展
  server-started / converter-started  服务就绪（含 url、token）
  error                  启动失败
```

如果采用“进程启动即开服”，Go 进程由 `connectNative()` 拉起后应自动启动服务；如果采用“等待首条消息”，Go 必须先读取并校验 `start-xxx`，扩展也必须在连接后发送对应消息。两种模式不要混用成“扩展发了消息但 Go 不处理”。

### 6.3 allowed_origins

**必须带结尾斜杠**，否则 Chrome 报 `Specified native messaging host not found`：

```json
"allowed_origins": ["chrome-extension://YOUR_EXTENSION_ID/"]
```

安装脚本写注册表后，有时需要**完全重启 Chrome** 才生效。

### 6.4 空闲超时（HTTP 驱动）

❌ **错误**：只在 Native Messaging 收到消息时重置计时器——用户持续使用 Web UI 但扩展不发消息，服务会被误杀。

✅ **正确**：HTTP 鉴权中间件里 `bumpIdle()`，SSE 推送时也重置：

```go
const idleTimeout = 10 * time.Minute

func (s *Server) auth(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        if !s.checkToken(r) { /* 401 */ return }
        s.bumpIdle()
        next(w, r)
    }
}

// main.go
go watchIdle(server.IdleReset(), idleTimeout, shutdown, idleStop)
select {
case <-stopCh:
case <-idleStop:
    log.Println("空闲超时，自动退出")
}
```

## 7. 扩展层实现

### 7.1 manifest.json 要点

```json
{
  "manifest_version": 3,
  "permissions": ["nativeMessaging"],
  "key": "MIIBIj...",
  "background": {
    "service_worker": "background.js"
  }
}
```

`permissions` 只需 `nativeMessaging`，不要申请多余权限。

### 7.2 固定扩展 ID

```bash
openssl genrsa -out key.pem 2048
openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A
# 输出填入 manifest.json 的 "key" 字段
```

### 7.3 loading 页模式（★ 必备）

MV3 Service Worker 生命周期不确定，**不能**等 native host 回复再开页面：

```javascript
// background.js
function startService() {
  openLoadingTab();                  // 1. 立即开 loading.html
  if (!port) connectNative();        // 2. 异步连接 native host
  if (port) sendMessage({ type: 'start-converter' }); // word2pdf 需要
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type === 'get-server-url') {
    sendResponse({ url: serverInfo?.url || null });
    return true;
  }
});

// 关 tab 时停服务
chrome.tabs.onRemoved.addListener(function(tabId) {
  if (tabId === openedTabId) stopService();
});
```

```javascript
// loading.js — 轮询直到拿到 URL
function pollUrl() {
  chrome.runtime.sendMessage({ type: 'get-server-url' }, function(res) {
    if (res?.url) window.location.href = res.url;
    else if (retries++ < 30) setTimeout(pollUrl, 400);
    else document.getElementById('hint').textContent = '启动超时，请重试';
  });
}
pollUrl();
```

## 8. HTTP 服务层

### 8.1 绑定地址选择

| 场景 | 绑定 | 示例 |
|------|------|------|
| 仅本机操作 | `127.0.0.1:0` | word2pdf |
| 局域网多设备 | `:0`（全接口） | lan-file-transfer |

### 8.2 Session Token 鉴权

每次启动生成随机 token，URL 携带，所有 `/api/*` 校验。token 至少 16 字节随机数，生成失败必须中止启动或返回明确错误，推荐使用 `io.ReadFull(rand.Reader, b)` 并处理错误。

```go
func (s *Server) checkToken(r *http.Request) bool {
    token := ""
    if auth := r.Header.Get("Authorization"); len(auth) > 7 && auth[:7] == "Bearer " {
        token = auth[7:]
    }
    if token == "" {
        token = r.URL.Query().Get("token")
    }
    return token == s.token
}
```

```javascript
// app.js
var token = new URLSearchParams(location.search).get('token');
if (!token) { /* 显示「请通过扩展打开」 */ return; }

var authHeaders = { 'Authorization': 'Bearer ' + token };
```

### 8.3 鉴权分级

| 级别 | 适用 | 措施 |
|------|------|------|
| 只读 API | `/api/status` | token |
| 写操作 API | 上传、转换、删除 | token + Origin/Referer 同源（本机工具） |
| LAN 开放 API | 多设备互传 | token + CORS `*` + 设备凭证 |
| PC 管理 API | LAN 插件的全量列表、打开本机目录等 | token + `isLocalhost(r)` |

本机工具（127.0.0.1）额外做 Origin 校验，防恶意网页 CSRF：

```go
func (s *Server) isSameOrigin(r *http.Request) bool {
    origin := r.Header.Get("Origin")
    if origin == "" {
        referer := r.Header.Get("Referer")
        if referer == "" { return false }
        return hasPrefixHost(referer, s.selfOrigin)
    }
    return origin == s.selfOrigin
}
```

LAN 工具不要把 token 当成设备身份。token 只表示同一个传输会话；每台设备注册时还需要服务端生成并返回 `deviceSecret`，后续文件列表、下载、上传、SSE 都必须校验 `deviceId + deviceSecret`。PC 端的全量管理视图、打开本机目录等能力必须限制为 localhost。

### 8.4 内嵌 Web UI

```go
//go:embed web/index.html web/style.css web/app.js web/qrcode.min.js
var webFS embed.FS

// 静态资源走 /static/ 前缀，避免与 API 路由冲突
staticFS, _ := fs.Sub(webFS, "web")
mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.FS(staticFS))))
mux.HandleFunc("/", handleIndex) // 只 serve index.html
```

**离线运行**：所有 JS/CSS/第三方库（如 QRCode）必须 embed，禁止依赖 CDN。

### 8.5 路径安全

```go
func validateLocalPath(path string) (string, error) {
    clean := filepath.Clean(path)
    if clean != path || containsDotDot(clean) {
        return "", fmt.Errorf("路径不规范")
    }
    abs, _ := filepath.Abs(clean)
    real, err := filepath.EvalSymlinks(abs)
    if err != nil { real = abs } // 输出目录可能尚不存在
    return real, nil
}
```

前端不要硬拼 Windows 路径，例如 `source + "/word2pdf_output"`。如果服务端要求 `filepath.Clean(path) == path`，混用 `/` 和 `\` 会导致合法 Windows 路径被判定为“不规范”。推荐由服务端返回默认输出路径，或前端用统一 helper 根据原路径分隔符拼接。

### 8.6 长任务状态

转换、压缩、批量处理等长任务要有独立状态位，不要复用取消标志推断“是否运行中”：

```go
func (s *Server) beginJob() bool {
    s.mu.Lock()
    defer s.mu.Unlock()
    if s.running { return false }
    s.running = true
    s.stopFlag.Store(false)
    return true
}

func (s *Server) endJob() {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.running = false
    s.stopFlag.Store(true)
}
```

任务启动前先占用槽位，所有失败路径和 goroutine 结束路径都要 `defer endJob()` 或显式释放，避免并发任务同时运行或状态卡死。

### 8.7 LAN 文件上传

LAN 上传接口必须控制输入和落盘边界：

- 用 `http.MaxBytesReader` 限制请求体大小。
- 文件名只接受 `filepath.Base(name)`，禁止路径分隔符和 `..`。
- 落盘用 `os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)` 原子创建；同名文件用 `(1)`、`(2)` 等后缀重试，避免并发覆盖。
- 移动端上传只能代表自己，不允许通过请求参数指定其他设备为上传者或目标；目标设备选择应只允许 PC 管理端操作。

## 9. Web UI 通信模式

### 9.1 常规 REST

```
GET  /api/status          查询状态（token）
POST /api/action          触发操作（token + Origin）
```

### 9.2 SSE 实时推送

**方式 A — GET SSE**（适合参数少的场景）：

```javascript
var es = new EventSource(
  '/api/events?token=' + encodeURIComponent(token) +
  '&deviceId=' + encodeURIComponent(deviceId) +
  '&deviceSecret=' + encodeURIComponent(deviceSecret)
);
es.addEventListener('file-added', function(e) { /* ... */ });
```

**方式 B — POST + 流式 SSE**（适合参数多、URL 不宜过长）：

```javascript
var res = await fetch('/api/convert', {
  method: 'POST',
  headers: { ...jsonHeaders },
  body: JSON.stringify({ source, output, files }),
});
var contentType = res.headers.get('Content-Type') || '';
if (!res.ok || !contentType.includes('text/event-stream')) {
  var message = await res.text(); // 可优先尝试 JSON error 字段
  throw new Error(message || '请求失败');
}
// 读取 res.body 流，按 \n\n 分割解析 event:/data: 行
```

word2pdf 采用方式 B；lan-file-transfer 采用方式 A。

SSE 格式：

```
event: progress
data: {"current": 3, "total": 10, "status": "success"}

```

注意：
- 长任务期间通过 `bumpIdle()` 防止空闲超时
- 完成时**不要自动跳转**，让用户确认后再切页面
- POST + 流式 SSE 必须处理非 SSE 错误响应。服务端校验失败通常返回 JSON/text，如果前端直接按成功流处理，会误显示“已完成”

### 9.3 服务退出 UI

```javascript
function showServiceStopped(reason) {
  document.querySelector('.container').hidden = true;
  document.getElementById('view-service-stopped').hidden = false;
}

async function apiFetch(url, opts) {
  try {
    var res = await fetch(url, { ...opts, headers: { ...authHeaders, ...opts?.headers } });
    if (res.status === 401) { showServiceStopped('会话已失效'); throw new Error('unauthorized'); }
    return res;
  } catch (e) {
    showServiceStopped('服务可能因空闲超时已关闭');
    throw e;
  }
}
```

## 10. Windows / COM 专节

仅 word2pdf 等需要调用 Office/WPS 的插件适用。

### 10.1 COM 线程模型

Office/WPS COM 是 STA，**所有 COM 调用必须在同一 OS 线程**：

```go
go func() {
    runtime.LockOSThread()
    defer runtime.UnlockOSThread()
    ole.CoInitializeEx(0, ole.COINIT_APARTMENTTHREADED)
    defer ole.CoUninitialize()
    // ... COM 操作 ...
}()
```

### 10.2 引用计数

`ToIDispatch()` 不增加引用计数，**只释放 VARIANT，不要双重 Release**：

```go
docsVar, _ := oleutil.GetProperty(app, "Documents")
defer docsVar.Clear()
docVar, _ := oleutil.CallMethod(docsVar.ToIDispatch(), "Open", path)
defer docVar.Clear()
```

COM 调用不要使用 `MustCallMethod`、`MustGetProperty`、`MustPutProperty`、`MustQueryInterface`。这些 helper 失败时会 panic，native host 可能直接退出，前端只能看到服务断开。推荐显式处理错误并通过 JSON 或进度事件返回给 UI：

```go
disp, err := unknown.QueryInterface(ole.IID_IDispatch)
if err != nil {
    return fmt.Errorf("无法获取 COM 接口: %w", err)
}

result, err := oleutil.PutProperty(disp, "Visible", false)
if result != nil { result.Clear() }
if err != nil {
    return fmt.Errorf("设置 Office 属性失败: %w", err)
}
```

### 10.3 进程清理

COM 退出后 Office/WPS 可能残留后台进程：

```go
beforePIDs := snapshotOfficePIDs()
// ... 工作 ...
killNewOfficeProcs(beforePIDs) // 只杀快照之后新出现的进程
```

⚠️ 插件运行期间用户手动打开的 Word/WPS，退出时也可能被误杀——需在 UI 提示用户。

### 10.4 Windows-only 源码

调用 `golang.org/x/sys/windows`、COM 或 Windows shell 的文件应加 build tag，并提供非 Windows stub，方便在 macOS/Linux 上运行纯逻辑测试：

```go
//go:build windows

package main
```

```go
//go:build !windows

package main

func snapshotOfficePIDs() map[uint32]bool { return map[uint32]bool{} }
func killNewOfficeProcs(before map[uint32]bool) {}
```

## 11. 安装与发布

```bash
# 编译
cd word2pdf-converter && make build-all   # 仅 Windows
cd lan-file-transfer  && make build-all   # 全平台

# 注册 native host
scripts\install.bat          # Windows
bash scripts/install.sh      # macOS / Linux

# Chrome 加载扩展
# chrome://extensions → 开发者模式 → 加载已解压的扩展程序 → extension/
```

install 脚本要点：
- 复制 `build/<platform>/` 二进制到用户目录
- 写 Native Messaging Host manifest（`allowed_origins` 带 `/`）
- Windows：注册 Chrome + Edge 注册表项，Edge 路径为 `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\<host>`
- macOS/Linux：symlink 到 `NativeMessagingHosts/` 目录
- `.bat` 文件用纯英文或 GBK，避免 UTF-8 中文导致 CMD 解析失败

预编译二进制提交到 `build/` 目录，用户 clone 后可直接 install。Go 源码改动后必须重新执行对应插件的 `make build-all`，否则安装脚本复制的仍是旧 native host。

## 12. 开发模式

无需安装扩展，单独调试 HTTP 服务：

```bash
cd lan-file-transfer/src
go run . --serve
# 输出 localhost URL + token，浏览器直接打开
```

word2pdf 无 `--serve` 模式（依赖 Native Messaging 首条消息），可临时在 `main()` 加 dev 分支。

## 13. 调试技巧

| 问题 | 方法 |
|------|------|
| native host 找不到 | 检查 `allowed_origins` 结尾 `/`、扩展 ID 是否匹配、重启 Chrome |
| SW 日志 | `chrome://extensions` → Service Worker → Inspect |
| Go 日志 | `log` 输出到 stderr（Chrome 不转发，可写文件） |
| SSE 断流 | DevTools → Network → EventStream |
| 端口占用 | Go 用 `:0` 随机端口，无需硬编码 |

## 14. 开发 Checklist

- [ ] `manifest.json` 加 `"key"` 固定扩展 ID
- [ ] `allowed_origins` 结尾加 `/`
- [ ] `loading.html` + 轮询模式，点击图标立即开页
- [ ] Native Messaging 读消息限制 1MB
- [ ] Native 协议只发送 Go 明确处理的消息；等待首条消息模式才发送 `start-xxx`
- [ ] HTTP 启动时用 `crypto/rand` 生成至少 16 字节 session token，处理随机数错误，URL 携带
- [ ] 所有 `/api/*` 走 token 鉴权
- [ ] 本机写操作加 Origin 校验
- [ ] LAN 设备操作加 `deviceId + deviceSecret` 校验，PC 管理能力仅 localhost
- [ ] 空闲超时由 **HTTP 活动** 驱动（默认 10 分钟）
- [ ] 服务退出时前端有明确提示
- [ ] 前端资源全部 embed，不依赖 CDN
- [ ] 前端路径拼接兼容 Windows `\`，不要硬拼 `/output`
- [ ] POST + SSE 先检查 `res.ok` 和 `Content-Type`，非流式错误要展示给用户
- [ ] 长任务有独立运行状态，所有失败/结束路径释放状态
- [ ] 关 tab → 扩展发 stop → Go 清理资源
- [ ] Windows COM：`LockOSThread` + 单点 Release + 禁用 `Must*` panic helper
- [ ] Windows-only 文件加 `//go:build windows`，非 Windows 提供 stub 以便跑单测
- [ ] 路径参数走 `validateLocalPath()`
- [ ] 上传接口限制大小、校验文件名、原子创建落盘文件
- [ ] `install.bat` 注册 Chrome + Edge
- [ ] 预编译二进制放入 `build/` 并提交；Go 改动后重新 `make build-all`
- [ ] 验证：`go test ./...`、`go vet ./...`、必要时 `GOOS=windows GOARCH=amd64 go test -c`、`make build-all`、`git diff --check`

## 15. 已知限制

- 多屏场景下，Go 调用的 Windows 原生文件夹对话框无法定位到浏览器所在屏幕
- `explorer /select,` 打开文件夹时逗号不能省略
- MV3 Service Worker 可能被 Chrome 回收；不要依赖 SW 长期驻留，靠 native host 进程独立运行
- lan-file-transfer 的 token 通过 QR 码分享给局域网设备，需信任同一局域网内的其他用户
