# JSON Formatter

> 离线 JSON 处理工具 — 格式化、压缩、树形浏览、格式互转、代码生成

## 使用

### 加载扩展

1. 打开 `chrome://extensions`
2. 开启「开发者模式」
3. 「加载已解压的扩展程序」→ 选择 `extension/` 目录
4. 点击工具栏图标 📦 即可打开

### 功能

| 功能 | 说明 |
|------|------|
| ✨ 格式化 | 美化 JSON（支持缩进 2/4 空格） |
| 🗜️ 压缩 | 去除多余空白 |
| 🔤 排序 | 按 key 排序 JSON 对象 |
| ↪️ 转义 / ↩️ 去转义 | JSON 字符串转义处理 |
| 🌳 树形视图 | 输入有效 JSON 后自动生成 |
| 🔄 格式转换 | JSON ↔ YAML / XML / TOML |
| 📄 代码生成 | JSON 转 TypeScript / Go / Python / Java / C# / Rust 类型定义 |
| 🔑 JWT 解码 | 在线解码 JWT token |
| 📚 历史记录 | 自动保存编辑历史 |
| 📂 打开文件 / 🌐 URL 导入 | 从文件或 URL 加载 JSON |
| 💾 下载 / 📋 复制 | 导出结果 |

### 右键菜单

- 选中页面中的 JSON 文本 → 右键 →「格式化选中 JSON」
- 页面空白处 → 右键 →「提取页面 JSON 数据」

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 监听模式（自动重建）
npm run watch
```

构建产物输出到 `extension/` 目录。
