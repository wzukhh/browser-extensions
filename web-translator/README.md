# 划词翻译-DeepSeek版

划词翻译浏览器插件。在任意网站选中单词、句子或段落，划词后**悬浮「翻译」按钮，点击才翻译**，不会自动弹窗打扰浏览。

**核心设计："详细但不啰嗦"**，划选文本属于哪一类由模型自行判断：

| 粒度 | 判断依据 | 展示内容 |
| --- | --- | --- |
| 单词 | 需要词典级讲解的词（模型判断） | 音标、词性释义（≤3 条）、例句、词根词缀、记忆点 |
| 短语 | 固定搭配/习语/常用短语（模型判断） | 整体含义、惯用法解释、例句、使用场景 |
| 句子 | 完整句子/分句/多句连排/整段（模型判断） | 整段翻译、语法批注、生词（含音标）、**句中短语/固定搭配讲解**、**必要背景知识**（梗/典故/特殊含义）、语气 |

粒度判断不按词数硬性区分：统一提示词让模型按语义判断，输出带 `type` 字段的 JSON，前端按其渲染。

单词/短语的深度内容（词根、例句等）在「更多」区，**默认展开**，可手动收起，保证卡片不啰嗦但有料。单词例句带中文翻译，被解释的单词加粗标出。

## 技术栈

- Manifest V3，纯原生 JS（esbuild 打包，无运行时依赖）
- 翻译引擎：DeepSeek API（`response_format: json_object`，输出固定 JSON 结构）
- 缓存：`chrome.storage.session` 会话缓存（同一浏览器生命周期内有效，关闭浏览器自动清空；上限 1000 条，LRU 截取）
- UI：Shadow DOM 浮窗，样式与页面隔离

## 安装使用

```bash
npm install
npm run build        # 产物在 extension/
npm run watch        # 开发模式
```

1. 构建后打开 `chrome://extensions`（或 `edge://extensions`）
2. 开启「开发者模式」→「加载已解压的扩展程序」→ 选择 `extension/` 目录
3. 点击工具栏图标，填入 DeepSeek API Key（<https://platform.deepseek.com/api_keys> 申请）
4. 模型下拉框自动从 `/models` API 拉取最新列表（DeepSeek 上线新模型无需手动改代码）；拉取失败自动回落默认选项
5. 任意网页划词 → 点击悬浮的「📖 翻译」按钮即可翻译

## 快捷键 / 交互

- 划词 → 选区**正上方**悬浮「翻译」按钮（**不会自动翻译**）
- 点击按钮 → 弹出翻译卡片（深度内容默认展开）
- 关闭：点击卡片外 / ✕ / `Esc`（**滚动页面不会关闭弹窗**，卡片浮在视口随读随看）
- ✋ 按住卡片**顶部拖动** → 自由移动（移动后不再自动定位，新划词翻译时才重新吸附到新选区）
- 📌 固定卡片：点击卡片外也不关闭，继续浏览不消失
- 🖊 卡片页脚右侧显示作者信息「作者 wzukhh | <wzukhh@163.com>」（设置页可关闭）
- ⧉ 复制**整张卡片的译文内容**为 **Markdown 格式**（`#` 标题 + 加粗标签 + 列表/引用块，例句中的 `**单词**` 即 Markdown 加粗，可直接粘贴进 Obsidian/Typora 等笔记）

## 安全说明

- API Key 以**明文**保存在浏览器本地存储（`chrome.storage.local`），不会随账号跨设备同步；同机同系统用户权限的进程或系统备份可能读取到该文件，请勿在不信任的设备上使用，并建议定期在 [platform.deepseek.com](https://platform.deepseek.com/api_keys) 轮换 Key
- Key 只会发送给你在设置页填写的 API 地址（默认 `https://api.deepseek.com`）；**修改 baseUrl 等价于把 Key 交给该地址**，请只填可信的 OpenAI 兼容端点
- 扩展不会向任何其他第三方发送 Key

## 目录结构

```
src/
├── manifest.json          # MV3 清单
├── content/content.js     # 划词监听 + 浮窗生命周期
├── background/background.js  # 缓存 + API 调用（service worker）
├── popup/                 # 设置页
└── lib/
    ├── granularity.js     # 文本粒度启发式（仅作缓存键与 type 兜底）
    ├── prompt-builder.js  # ★统一大而全 prompt：模型自行判断粒度 + JSON 兜底（核心）
    ├── api.js             # DeepSeek 调用（translate + listModels）
    ├── cache.js           # 会话级缓存（chrome.storage.session + LRU 1000 条）
    └── renderer.js        # Shadow DOM 卡片 + 翻译按钮渲染
```

## 后续规划

- [ ] 悬停查词（hover 出小卡片）
- [ ] 生词本 / 历史记录
- [ ] 整段翻译快捷键
- [ ] 更多 Provider（Gemini / OpenAI 兼容接口已抽象，改 baseUrl 即可）
- [ ] 双语对照整页翻译

---

此插件由 pi agent + deepseek v4 flash 0731 开发完成。
