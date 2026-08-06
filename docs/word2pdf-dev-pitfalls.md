# Word→PDF 转换器 —— 开发踩坑记录

## 1. 原生消息 (Native Messaging) 通信

### 1.1 allowed_origins 必须带结尾斜杠

**错误写法**（Chrome 不认，报 `Specified native messaging host not found`）：

```json
"allowed_origins": ["chrome-extension://lcfjnnpibdelbejfdeflbifofcblhlnh"]
```

**正确写法**：

```json
"allowed_origins": ["chrome-extension://lcfjnnpibdelbejfdeflbifofcblhlnh/"]
```

缺少 `/` 会导致 Chrome 完全找不到 native host，且不会报具体错误。排查了很长时间才发现。

### 1.2 Native Host 注册后要重启 Chrome

`install.bat` 写注册表后，Chrome 可能不会立即识别新的 native host。需要**完全重启 Chrome** 才能生效。

### 1.3 消息帧格式

Native Messaging 帧是 **4 字节小端无符号整数 (uint32 LE) + JSON payload**：

```go
header := make([]byte, 4)
binary.LittleEndian.PutUint32(header, uint32(len(payload)))
os.Stdout.Write(header)
os.Stdout.Write(payload)
```

---

## 2. COM 与 Go 的线程模型 —— 最坑的一个

### 2.1 COM Apartment Threading

Office/WPS 的 COM 对象是 **Apartment-Threaded (STA)**，COM 调用必须在**同一个 OS 线程**上进行。Go 的 goroutine 可能会在调度时被切换到不同的 OS 线程，这会导致：

```
应用程序调用一个已为另一线程整理的接口  (RPC_E_WRONG_THREAD / 0x8001010E)
```

**症状**：第 1~2 个文件可以正常转换，第 3 个文件开始失败。因为 Go 的 goroutine 一开始在主线程上（有 COM 初始化），被调度到其他线程后 COM 调用就崩了。

**解决方法**：

```go
go func() {
    runtime.LockOSThread()        // 固定到当前 OS 线程
    defer runtime.UnlockOSThread()

    ole.CoInitializeEx(0, ole.COINIT_APARTMENTTHREADED)  // 每个使用 COM 的线程都要初始化
    defer ole.CoUninitialize()

    // ... COM 操作 ...
}()
```

### 2.2 go-ole 的引用计数管理

`go-ole` 中 `ToIDispatch()` 返回的指针**不增加引用计数**，它和原始 VARIANT 共享同一个引用。**不能同时对 VARIANT 和 IDispatch 各自 Release**，否则会双重释放，导致后续 COM 调用失败。

**错误写法**（双重释放）：

```go
docs, _ := oleutil.GetProperty(app, "Documents")
docsDisp := docs.ToIDispatch()
docVar, _ := oleutil.CallMethod(docsDisp, "Open", ...)
docs.Clear()           // 第一次 Release
docsDisp.Release()     // 第二次 Release —— COM 对象引用计数损坏！
```

**正确写法**（只有一个 Release）：

```go
docsVar, _ := oleutil.GetProperty(app, "Documents")
defer docsVar.Clear()                 // 只让 VARIANT 释放

docVar, _ := oleutil.CallMethod(docsVar.ToIDispatch(), "Open", ...)
defer docVar.Clear()                  // docVar 同理

doc := docVar.ToIDispatch()           // 共享引用，不 AddRef
_, _ = oleutil.CallMethod(doc, "ExportAsFixedFormat", ...)
```

### 2.3 每个线程独立初始化 COM

`ole.CoInitializeEx` 是**线程级别**的函数。主线程调用了不等于子线程可用。每个使用 COM 的 goroutine 都需要独立调用 `CoInitializeEx` + `CoUninitialize`。

### 2.4 WPS 进程清理

WPS 通过 COM 激活后，即使 `app.Quit()` + `app.Release()` 后，仍可能残留后台进程（包括 `wps.exe` 自身和 `wpscloudsvr.exe` 登录服务等子进程）。

**解决方案**：转换开始前快照所有 WPS 相关进程的 PID，转换结束后杀掉新出现的进程。

```go
beforePIDs := snapshotOfficePIDs()
// ... 转换 ...
killNewOfficeProcs(beforePIDs)
```

用 `CreateToolhelp32Snapshot` + `Process32First`/`Next` 遍历进程，用 `TerminateProcess` 杀掉。匹配策略：`WINWORD.EXE` 精确匹配，WPS 系列用名字含 `WPS` 模糊匹配（以覆盖 `wpscloudsvr.exe` 等子进程）。

注意：`DetectOffice()` 本身也会创建 COM 对象，同样可能启动 WPS 进程。所以需要在主函数中也做快照+清理。

---

## 3. 扩展加载 (Extension) 注意事项

### 3.1 Service Worker 生命周期

MV3 的 Service Worker 是事件驱动的，可能被 Chrome 随时终止。

**使用 loading.html 模式**（参考 `lan-file-transfer`）：

```
点击图标 → 立即打开 loading.html → loading 页轮询 service worker 拿 URL → 拿到后跳转
```

而不是：

```
点击图标 → 等 native host 回复 → 再开页面  ❌（时序容易出问题）
```

### 3.2 type: "module" 限制

MV3 service worker 用 `"type": "module"` 会使代码运行在 module 作用域。如果不需要 `import`/`export`，可以不加，减少兼容性问题。

### 3.3 扩展 ID 固定

需要用 `"key"` 字段固定扩展 ID，否则加载解包扩展时每次 ID 都可能变化，native host 的 `allowed_origins` 就没法匹配。

生成方式：

```bash
openssl genrsa -out key.pem 2048
openssl rsa -in key.pem -pubout -outform DER | sha256sum
# 将 hex 结果的前 32 字符映射到 a-p（0→a, 1→b, ..., f→p）
```

### 3.4 chrome.runtime.connectNative 特性

- `connectNative` 返回的 Port 对象是同步创建的，但**底层连接是异步的**
- 消息发送后可能被 Chrome 缓冲，直到 native host 就绪
- 可以用 `setTimeout(100ms)` 发消息，确保 port 已就绪

### 3.5 EventSource (SSE) 的注意点

- SSE 只支持 **GET** 请求
- 需要做 Origin 校验防 CSRF（虽然只绑 127.0.0.1）
- `onerror` 在连接正常关闭时也会触发，不要和真正错误混淆
- 转换完成时**不要自动跳转**，让用户自己点"查看结果"

---

## 4. Windows 相关

### 4.1 批处理文件编码

`install.bat` 在 Windows 中文系统上要以 **GBK/ANSI** 编码保存，或者**完全用英文**（不含中文字符）+ `chcp 65001`。UTF-8 中文会让 CMD 解析出错。

### 4.2 原生文件夹选择对话框

通过 `Shell.Application.BrowseForFolder` COM 接口调用。注意：
- 该对话框无法控制弹出位置（多屏场景下不一定在浏览器所在的屏幕弹出）
- `BIF_RETURNONLYFSDIRS | BIF_EDITBOX = 0x0011`

### 4.3 单文件二进制分发

Go 编译的单文件 .exe 约 9.7MB（含 go-ole + Go runtime），无需额外运行时依赖。

---

## 5. 项目结构模板

```
plugin-name/
├── src/                     # Go 源码
│   ├── main.go              # 入口 + native messaging 协议
│   ├── detector.go          # Office/WPS 检测
│   ├── converter.go         # 转换核心逻辑
│   ├── server.go            # HTTP API + SSE
│   ├── cleanup.go           # 进程清理
│   ├── web_embed.go         # 内嵌前端资源
│   ├── web/                 # 前端 UI
│   │   ├── index.html
│   │   ├── style.css
│   │   └── app.js
│   ├── go.mod / go.sum
├── extension/               # 浏览器扩展
│   ├── manifest.json
│   ├── background.js
│   ├── loading.html / loading.js
│   └── icons/
├── scripts/
│   ├── install.bat          # 注册 native host
│   └── uninstall.bat
├── native-host-template.json
├── key.pem
├── Makefile
└── README.md
```

## 6. 快速开发 checklist

- [ ] `manifest.json` → 加 `"key"` 固定扩展 ID
- [ ] `background.js` → 用 loading 页模式，点击图标立即开页面
- [ ] `native-host-template.json` → `allowed_origins` 结尾加 `/`
- [ ] `install.bat` → 不含中文字符或 GBK 编码
- [ ] `main.go` → 全局 `CoInitializeEx` + `runtime.LockOSThread`
- [ ] `converter.go` → COM 引用计数只释放一次
- [ ] `cleanup.go` → `snapshotOfficePIDs` 前后对比杀进程
