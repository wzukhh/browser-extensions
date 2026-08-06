# web-translator 项目上下文

划词翻译浏览器插件（MV3 + DeepSeek API）。**接手请先读 `HANDOFF.md`** —— 里面有设计决策、进度、已知坑和下一步验收清单。

快速导航：
- `HANDOFF.md` → 设计与进度交接（必读）
- `README.md` → 构建/加载/使用说明
- `src/lib/prompt-builder.js` → 粒度分级 prompt（项目灵魂，调优重点）
- `src/lib/renderer.js` → 卡片渲染
