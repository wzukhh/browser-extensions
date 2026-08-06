# 划词翻译-DeepSeek版 — 设计与进度交接文档

> 供后续会话快速接手。最后更新：2026-08-05。
> 阅读顺序：本文档 → `README.md`（使用说明）→ 对应源码文件。

## 1. 项目一句话定位

划词翻译浏览器插件（MV3）：在 Reddit 等国外网站选中文本，弹出翻译卡片。**核心诉求是"详细但不啰嗦"**——单词给词典级详解，句子给翻译+批注，段落给概括+要点，但信息量控制严格。

## 2. 关键设计决策（勿轻易推翻，改动前先看这里）

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| 翻译引擎 | **纯 LLM API（DeepSeek）** | "单词详解+语法批注+篇幅克制"本质是 LLM 的活，词典 API 给不了语境解释。成本可忽略（单词卡 ~150 token/次） |
| 交互 | **划词后悬浮「翻译」按钮，点击才翻译**（不自动弹窗） | 避免每次划词都自动弹卡片打扰阅读；用户痛点仍是"复制去别处翻译太麻烦"，划词+单击最省事。悬停查词留作 V2 |
| 模型选择 | **设置页动态拉取 `/models` API**，不硬编码 | DeepSeek 新模型（如 v4 系列）上线后无需改代码；拉取失败回落默认选项 |
| 粒度分级 | **3 级：word/phrase/sentence**，模型自行判断（统一 prompt + `type` 字段），段落并入 sentence | 多句/整段按 sentence 要求输出（整段连贯翻译 + 生词/短语/背景讲解），不再出 summary/points。`lib/granularity.js` 规则仅作缓存键与兜底 |
| 篇幅控制 | ① prompt 里每个字段带硬性字数上限 ② 深度内容放「更多」区但**默认展开**（可手动收起） | 双保险，防止模型灌水和卡片臃肿；展开优先保证信息可见 |
| 输出格式 | `response_format: json_object` + 固定 JSON schema | 前端直接渲染，不解析自然语言 |
| 构建 | esbuild 打包 `src/` → `extension/`（纯 JS、ESM、无运行时依赖） | 与仓库里 json-formatter 插件模式一致 |
| 缓存 | **`chrome.storage.session` 会话缓存**，key=`lang:粒度:文本`，上限 1000 条 LRU 截取 | 同一浏览器生命周期内命中即返；浏览器关闭自动清空（内存存储），SW 重启不丢。比 IndexedDB+TTL 更贴合"临时缓存"语义 |
| 例句格式 | 单词卡例句用 **`**加粗**`** 标出被解释单词，附 `exampleZh` 中文翻译 | 一眼看出单词用法，无需再查句子含义 |
| UI 隔离 | Shadow DOM 浮窗 | 避免页面 CSS 污染卡片 |

## 3. 目录结构与模块职责

```text
web-translator/
├── package.json              # esbuild 构建，npm run build / watch
├── build.mjs                 # 打包 3 个 JS 入口 + 复制 manifest/popup/icons
├── README.md                 # 使用说明（构建/加载/交互）
└── src/
    ├── manifest.json         # MV3：storage 权限 + api.deepseek.com host 权限
    ├── content/content.js    # 划词监听(mouseup) + 翻译按钮 + 浮窗生命周期(Esc/点击外/滚动关闭、📌固定)
    ├── background/background.js  # 消息路由：查缓存→调 API→写缓存→返回
    ├── popup/                # 设置页：API Key/模型(动态拉取)/目标语言 + 测试连接按钮
    └── lib/
        ├── granularity.js    # normalizeText + detectGranularity（粒度判断规则）
        ├── prompt-builder.js # ★核心：4 粒度 prompt + JSON schema + sanitizeResult 兜底
        ├── api.js            # DeepSeek 调用：chat completions + listModels（baseUrl/model 可配）
        ├── cache.js          # 会话级缓存：chrome.storage.session + LRU 1000 条（关闭浏览器自动清空）
        └── renderer.js       # ★Shadow DOM 卡片 + 翻译按钮渲染（纯 DOM API，无 innerHTML）
```

## 4. 当前进度

- [x] 项目骨架、构建脚本（esbuild，`npm run build` 通过）
- [x] 粒度识别、分级 prompt、JSON 兜底（`prompt-builder.js` 完成）
- [x] DeepSeek API 调用 + IndexedDB 缓存（background 链路完成）
- [x] 划词浮窗 + Shadow DOM 卡片渲染（content 链路完成）
- [x] 设置页（API Key/模型/目标语言/测试连接）
- [x] 语法验证：manifest JSON 有效、3 个 bundle 文件 `node --check` 通过
- [x] 代码走查修复（2026-08-05）：
  - **Shadow DOM 点击判定**：`host.contains(shadow元素)` 按规范返回 false，原来点卡片内按钮会直接关卡。改用 `composedPath().includes(host)`
  - **复用卡片粒度/原文不刷新**：`createCard` 闭包捕获首次粒度，先选单词再选句子会渲染错版。新增 `setContext()`
  - **定位测量不准 + 渲染后不重排**：改测卡片本体 `el`，结果/错误渲染后重新 `positionCard`
  - **慢响应竞态**：`requestId` 令牌，过期响应丢弃
  - manifest 增加 `clipboardWrite` 权限，复制按钮可靠生效
- [x] 交互改造（2026-08-05）：**划词 → 悬浮「翻译」按钮 → 点击才翻译**，不再自动弹卡。新增 `createTrigger()`（Shadow DOM 按钮），触发/卡片点击均用 composedPath 判定
- [x] 设置页模型列表动态化（2026-08-05）：`listModels()` 拉取 `/models` API 填充下拉框，失败回落 `deepseek-chat/deepseek-reasoner`；🔄 可手动刷新
- [x] 渲染器重构（2026-08-05）：全部改用 DOM API + textContent（无 innerHTML），同时消除 XSS 面与 lint 告警
- [x] 交互打磨（2026-08-05）：① 翻译按钮停靠选区**正上方**（水平居中，放不下翻下方）② 「更多」默认展开可收起 ③ 单词卡例句带中文翻译 + `**单词**` 加粗（prompt schema 加 `exampleZh`）④ 复制按钮改复制**整卡译文纯文本**（`buildCardText`），固定按钮修复（外部点击不再误关固定卡片）；后升级为复制 **Markdown**（`buildCardMarkdown`）
- [x] 缓存换会话级（2026-08-05）：IndexedDB+TTL → `chrome.storage.session`（浏览器关闭自动清空，SW 重启不丢），LRU 上限 1000 条
- [x] 修复翻译按钮水平定位（2026-08-05）：`.wt-trigger` 是块级 flex，宿主 `:host{all:initial}` 为 inline 不能做包含块 → 按钮宽度退化为整页宽，offsetWidth 测出 1200px，居中公式被钳到屏幕左缘。修复：`width: max-content` + 宿主 `display: inline-block`
- [x] 翻译按钮定位改为 `position: fixed`（2026-08-05）：视口坐标直算（`rect.left + (rect.width-w)/2`），彻底去掉 scrollX/scrollY 换算，杜绝滚动相关定位故障。已用无头 Chrome 真机验证：无滚动/横向滚动 400px 下按钮中心与选区中心偏差均 0.2px；多行段落因包围盒含右端空白，视觉中心略左移属正常
- [x] 句子卡增强（2026-08-05）：schema 的 `idioms` 升级为 `phrases`（句中重要短语/固定搭配/习语，≤3 条）+ 新增 `background`（必要背景知识：梗/典故/特殊含义，≤40 字，无则空串）。渲染器新增「短语搭配」「背景知识」区块（背景用 💡 黄底样式），渲染与复制文本均兼容旧 `idioms` 字段（会话缓存里旧数据不丢）
- [x] 卡片可拖拽移动（2026-08-05）：按住头部拖动整卡（排除三个按钮），定位改 `position: fixed`（视口坐标），拖拽用 clientX/Y 直算并钳制在视口内；用户手动移动后 `dragged` 标记停止自动定位，新划词翻译时才重新吸附到新选区。无头 Chrome 验证：拖拽位移精确、自动固定生效
- [x] 弹窗关闭逻辑调整（2026-08-05）：**滚动不再关闭弹窗**（卡片 fixed 定位浮在视口随读随看），只保留点击外部/✕/Esc 关闭；临时翻译按钮仍在滚动时隐藏。同步移除「拖拽自动固定」（与"点外部关闭"冲突，固定改为纯手动 📌）。无头 Chrome 验证：滚动后卡片保留、按钮隐藏
- [x] 页脚作者信息（2026-08-05）：卡片页脚右侧显示固定文本「作者 wzukhh | <wzukhh@163.com>」，设置页新增「卡片页脚显示作者信息」开关（`showAuthor`，默认开）。content script 启动读配置 + `storage.onChanged` 监听，设置页中途切换已打开的卡片实时生效
- [x] 插件改名 + 图标化（2026-08-05）：扩展名改「划词翻译-DeepSeek版」（manifest name/description/default_title、设置页标题同步）。4 个免费 SVG 图标（复制/Pin/翻译/model，来源 /Users/wsh/Downloads）替换 UI emoji：📌→Pin、⧉→复制、📖→翻译、段落摘要📌→Pin、设置页标题🌐→翻译、模型标签→model。renderer 用 createElementNS 内联 SVG（`src/lib/icons.js`，静态 path 无注入面），popup 用 `<img src="../icons/*.svg">`（图标放 src/icons/，build 自动拷到 extension/icons/）。⚠️ manifest 图标不支持 SVG，已用 ImageMagick 将翻译.svg 转成 16/32/48/128 PNG 注册为扩展图标（manifest icons + action.default_icon）
- [x] **真机验收完成（2026-08-05）**：用户已在 Chrome 实测通过——划词→按钮→点击翻译全流程、卡片可拖拽/固定/关闭、滚动不关弹窗、例句加粗+中文、短语搭配/背景知识区块、页脚作者信息、动态模型列表均正常
- [x] 粒度判断改为模型决策（2026-08-05）：4 套分级 prompt 合并为**单一统一 prompt**（`prompt-builder.js` 的 MEGA_PROMPT），JSON 输出带 `type` 判别字段，模型按语义自行判断 word/phrase/sentence/paragraph 并只填对应字段；渲染端按 `data.type` 渲染并同步徽章。`granularity.js` 规则降级为缓存键 + type 兑底（`normalizeType`/`sanitizeResult` 双保险）

## 5. 已知坑与注意事项

1. **Node 24 限制**：本机 Node 是 v24，`node --experimental-strip-types` 对 node_modules 下的 `.ts` 直接报错（`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`）。本项目纯 JS 不受影响，但涉及 TS 脚本时要小心。
2. **CORS**：content script 直接 fetch DeepSeek 会被 CORS 拦，所以 API 调用统一走 background service worker（manifest 的 host_permissions 已配 `api.deepseek.com`）。
3. **service worker 是 ESM**：manifest 里 `"type": "module"`，构建 `format: 'esm'`，两者必须匹配。
4. **页面脚本冲突**：content script 用 `window.getSelection()`，在部分站点（如 iframe 多的站）可能拿不到选区，真机测试时留意。
5. **`response_format: json_object` 要求**：DeepSeek 官方要求该模式下 prompt 里必须出现 "json" 字样且提示词完整（prompt-builder 已满足）。
6. **切换 Provider**：`api.js` 已抽象，改设置页 baseUrl 即可接任何 OpenAI 兼容接口；但 manifest 的 `host_permissions` 需要同步加对应域名。
7. **改 content script 后必须重载扩展**：`chrome://extensions` 里点该扩展的「重新加载」按钮，只刷新页面无效——旧 content script 会一直注入到扩展重载为止。调试定位/交互改动时最容易踩。（设置页曾有过一键重载按钮，已按用户要求移除——仅调试期用得上，发布版不需要。）
8. **调试工具**：`test/position-test.html`（配合 `python3 -m http.server` 起服务）可在无头 Chrome 里真机验证按钮/卡片定位偏差（需先 `npm run build`）。根 .gitignore 已忽略 `test/`，不会入库。

## 6. 真机验收（已完成 2026-08-05）

✅ 用户已在 Chrome 真机验收通过，覆盖：三类划词（单词/句子/段落）翻译质量、按钮居中/点击才翻译、卡片拖拽/固定/关闭（点击外/✕/Esc）、滚动不关弹窗、例句加粗+中文、短语搭配/背景知识、页脚作者开关、动态模型列表、会话缓存。

后续可迭代方向（非阻塞）：

- **prompt 微调**：释义字数、例句相关性、批注质量（改 `prompt-builder.js` 的 SCHEMAS）
- **渲染微调**：卡片宽度/字体/折叠逻辑（改 `renderer.js`）
- V2 规划：悬停查词、生词本、整段翻译快捷键、更多 Provider、双语对照整页翻译

## 7. 用户背景（协作要点）

- 用户是 **Java 21 开发者**（Jackson/EasyExcel/Lombok），浏览器插件是副业向项目
- 仓库 `/Users/wsh/code/browser-plugin/` 是插件集合，已有 word2pdf-converter（Go 桥接）、lan-file-transfer、diagram-kit、chrome-new-tab、json-formatter，风格是"每个插件独立子目录 + README 列表"
- 中文交流，注释/文档用中文
- 用户偏好直接干活的节奏，少问、给结论、可逆操作直接执行
