# New Tab — Chrome / Edge new tab page

> English | [简体中文](./README.md)

A clean, minimal browser new-tab replacement extension. Multi-search-engine, quick link management, multiple themes, custom backgrounds, and a trending-news module.

## Features

**Search** — Google, Baidu, Bing, Yandex and more, with support for adding custom search engines. Icons are fetched automatically and served from the browser cache when offline.

**Quick links** — Fast access to frequently visited sites; add custom links and built-in modules (e.g., trending news). Add, edit, delete, and drag-and-drop reordering. Site icons are fetched automatically, with support for `chrome://` and `edge://` internal pages (emoji icons as fallback). Batch-edit mode (select all / row / single click, batch delete). Import from browser bookmarks.

**Trending news** — Built-in module; clicking the shortcut opens a floating panel that switches between Weibo / Baidu / Douyin hot lists, opening entries in new tabs. Auto-refreshes every 10 minutes while the new tab page is open; news loading can be disabled in settings (handy for intranet environments).

**Themes** — 4 visual styles: Classic Dark, Cyber Future (CRT scanline/noise ambience with intermittent glitch effects, individually toggleable), Magazine Minimal, and Night Warm. All themes persist automatically.

**Background** — Gradient, solid color (with paste-any-color-value support), and custom image backgrounds.

**Tools** — Clock display, config export/import (file picker and online URL import; export automatically omits background-image base64 data).

## Data source

The Weibo, Baidu and Douyin trending lists come from the [XunJingLu API](https://api.xunjinlu.fun/). Thanks to the API provider.

## Installation

1. Open Chrome or Edge (Chromium), and go to the extensions page (`chrome://extensions/`)
2. Enable "Developer mode" (top right)
3. Download the source archive from Releases and extract it, or `git clone` this repository
4. Click "Load unpacked" and select the `chrome-new-tab` folder
5. Open a new tab to start using it

## License

MIT
