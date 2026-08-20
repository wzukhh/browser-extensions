# DiagramKit

> [English](./README.en.md) | 简体中文

Chrome / Edge 浏览器插件 — Mermaid 与 Markmap 图形编辑工具。

点击扩展图标打开全屏页面，支持 Mermaid 图表和 Markmap 脑图编辑、实时渲染预览、导出渲染图。

## 功能

- **多工具切换** — 顶部切换 Mermaid / Markmap，各自保留标签页、模板和存档
- **编辑器** — CodeMirror 6 编辑器，支持 Mermaid 语法和 Markmap Markdown 编辑
- **实时预览** — Mermaid 输入即渲染；Markmap Markdown 实时生成脑图
- **导出** — PNG / SVG 一键导出
- **模板库** — Mermaid / Markmap 独立模板库，支持添加/编辑/删除/批量管理
- **图表存档** — Ctrl+S 保存当前工具文档，最多 50 条，支持切换管理
- **主题** — 4 套渲染主题（默认/清澈/暖茶/薄荷），可持久化保存
- **快捷键** — Ctrl+S 保存、Ctrl+N 新建、Ctrl+W 关闭、Ctrl+Shift+E 导出
- **草稿恢复** — 内容变化实时保存到打开标签，刷新不丢失；Ctrl+S 后进入图表存档

## 安装

### 方式一：直接加载 release-plugin（推荐）

```bash
# 解压或 clone 后，直接加载 release-plugin 文件夹
```

在 Chrome/Edge 中打开 `chrome://extensions`，开启右上角「开发者模式」，点击「加载已解压的扩展程序」，选择 `release-plugin` 文件夹即可。

> `release-plugin/` 是预构建产物，无需 Node.js 环境，直接可用。

### 方式二：自行编译

```bash
cd diagram-kit
npm install
npm run build
```

编译完成后，加载 `release-plugin/` 目录。编译产物会自动同步到 `release-plugin/`。

## 开发

```bash
cd diagram-kit
npm run dev
```

Vite 开发服务器运行在 `http://localhost:5173`。存储降级为 `localStorage`，编辑/保存/主题等功能均可正常使用。

## 构建

```bash
npm run build
```

输出到 `release-plugin/` 目录，可直接作为未打包扩展加载。
