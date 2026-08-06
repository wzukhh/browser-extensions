# Browser Plugin

> [English](./README.en.md) | 简体中文

浏览器插件集合。

## 插件列表

### [word2pdf-converter](./word2pdf-converter)

Word → PDF 批量转换器。浏览器扩展 + Go Native Messaging 本地桥梁，通过 COM 接口调用 Office/WPS 完成转换。**仅支持 Windows。**

- 支持 Microsoft Office 和 WPS Office，自动检测优先使用 Office
- 实时转换进度（SSE 推送）
- 成功/失败文件列表展示
- 自动清理残留 WPS 进程

### [lan-file-transfer](./lan-file-transfer)

局域网文件传输工具。浏览器扩展 + Go 本地 HTTP 服务器，通过二维码扫码在同一局域网内的设备间传输文件。

- 扫码即可互传，无需配置
- 支持大文件上传（200MB 以内）
- 实时进度展示（SSE）
- Windows / macOS / Linux 全平台支持

### [diagram-kit](./diagram-kit)

Chrome / Edge DiagramKit 图形编辑器插件。提供 Mermaid / Markmap 编辑、实时渲染预览、导出 PNG/SVG/PDF、模板库、图表存档等功能。

### [chrome-new-tab](./chrome-new-tab)

Chrome / Edge 新标签页替换插件。提供多搜索引擎、快捷链接管理、多主题切换、自定义背景等丰富功能。

### [json-formatter](./json-formatter)

JSON 格式化浏览器插件。在浏览器中直接格式化、压缩、校验 JSON 数据。

### [web-translator](./web-translator)

划词翻译浏览器插件。选中单词/短语/句子/段落，划词后悬浮「翻译」按钮，点击才翻译：单词给词典级详解，句子给翻译与语法批注，段落给概括与要点。翻译引擎使用 DeepSeek API，设置页自动拉取最新模型列表。
