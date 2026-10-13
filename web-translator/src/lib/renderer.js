/**
 * 浮窗卡片渲染器：把 LLM 流式 Markdown 渲染成紧凑卡片。
 * 使用 Shadow DOM 隔离样式，避免被页面 CSS 污染。
 *
 * 信息架构（"详细但不啰嗦"）：
 *  - 默认层：核心信息（词条释义 / 短语含义 / 句子翻译 / 段落概括+翻译）
 *  - 更多层：展开语法批注、生词、习语、词根等深度内容
 *
 * 全部用 DOM API 构建节点（textContent），不用 innerHTML，杜绝注入面。
 */

import { svgIcon, PIN_ICON, COPY_ICON, TRANSLATE_ICON } from "./icons.js";
import { parseCardMarkdown } from "./markdown-card.js";

const WIDTH = 440;
const BADGE_LABELS = {
	word: "单词",
	phrase: "短语",
	sentence: "句子",
	paragraph: "段落",
};

const STYLE = `
:host { all: initial; }
* { box-sizing: border-box; margin: 0; padding: 0; }
.wt-card {
  width: ${WIDTH}px;
  max-width: calc(100vw - 24px);
  max-height: min(70vh, calc(100vh - 24px));
  overflow-y: auto;
  background: #ffffff;
  color: #1f2328;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.12);
  border: 1px solid rgba(0,0,0,.08);
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  line-height: 1.55;
}
.wt-card ::selection { background: #cfe4ff; }
.wt-header {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  position: sticky; top: 0; background: #fff; border-radius: 12px 12px 0 0;
  z-index: 1; /* sticky 时盖住滚动上来的正文，避免文字重叠 */
  user-select: none; cursor: grab;
}
.wt-badge {
  font-size: 11px; font-weight: 600; color: #fff;
  background: #4a6cf7; border-radius: 4px; padding: 1px 6px;
  flex-shrink: 0;
}
.wt-src {
  flex: 1; font-size: 12px; color: #57606a;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.wt-btn {
  border: none; background: transparent; cursor: pointer;
  font-size: 13px; color: #8b949e; padding: 2px 4px; border-radius: 4px;
  line-height: 1; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
}
.wt-btn:hover { background: #f0f2f5; color: #1f2328; }
.wt-btn:focus-visible, .wt-more-btn:focus-visible { outline: 2px solid #4a6cf7; outline-offset: 1px; }
.wt-btn.wt-pinned { color: #4a6cf7; }
.wt-body { padding: 10px 12px 12px; }
.wt-loading { display: flex; align-items: center; gap: 10px; padding: 14px 0; color: #57606a; }
.wt-spinner {
  width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid #e5e9f0; border-top-color: #4a6cf7;
  animation: wt-spin .8s linear infinite;
}
@keyframes wt-spin { to { transform: rotate(360deg); } }
.wt-error { color: #cf222e; padding: 6px 0; }
.wt-error .wt-retry { color: #4a6cf7; cursor: pointer; text-decoration: underline; margin-left: 8px; }
.wt-stream-status { display: flex; align-items: center; gap: 7px; margin-top: 10px; color: #6e7781; font-size: 11px; }
.wt-stream-status .wt-spinner { width: 12px; height: 12px; }
.wt-stream-warning { margin-top: 10px; padding: 7px 9px; border-radius: 6px; background: #fff8e6; color: #7a5b00; font-size: 12px; }
.wt-stream-warning .wt-retry { color: #4a6cf7; cursor: pointer; margin-left: 6px; }
.wt-md p + p { margin-top: 6px; }
.wt-md strong { color: #1f2328; font-weight: 700; }
.wt-md em { font-style: italic; }
.wt-md code { background: #f6f8fa; padding: 1px 3px; border-radius: 3px; }
.wt-md blockquote { border-left: 2px solid #b8c5ff; padding-left: 8px; color: #57606a; margin: 5px 0; }
.wt-md .wt-ul { margin: 3px 0; }
.wt-md-primary { font-size: 15px; font-weight: 600; color: #0b1220; line-height: 1.6; }
.wt-md-primary .wt-ul { font-size: 13px; font-weight: 400; }

/* word */
.wt-phonetic { color: #6e7781; font-size: 12px; margin-bottom: 6px; }
.wt-pos-item { margin-bottom: 8px; }
.wt-pos-tag {
  display: inline-block; font-size: 11px; font-weight: 700; color: #4a6cf7;
  background: #eef1fe; border-radius: 4px; padding: 1px 5px; margin-right: 6px;
}
.wt-def { color: #1f2328; }
.wt-example { color: #57606a; font-size: 12px; font-style: italic; margin-top: 2px; }
.wt-example b { font-weight: 700; color: #4a6cf7; font-style: normal; }
.wt-example-zh { color: #24292f; font-style: normal; }

/* phrase / sentence */
.wt-translation { font-size: 15px; font-weight: 600; color: #0b1220; margin-bottom: 8px; }
.wt-explanation { color: #24292f; margin-bottom: 8px; }

/* lists */
.wt-section { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #e5e9f0; }
.wt-section-title {
  font-size: 11px; font-weight: 700; color: #8b949e;
  text-transform: uppercase; letter-spacing: .4px; margin-bottom: 4px;
}
.wt-ul { list-style: none; }
.wt-ul li { padding: 3px 0 3px 14px; position: relative; color: #24292f; }
.wt-ul li::before {
  content: "•"; position: absolute; left: 2px; color: #4a6cf7; font-weight: 700;
}
.wt-vocab { display: flex; gap: 8px; align-items: baseline; }
.wt-vocab .w { font-weight: 600; color: #0b1220; flex-shrink: 0; }
.wt-vocab .ph { color: #6e7781; font-size: 12px; flex-shrink: 0; }

/* paragraph */
.wt-bg-note {
  background: #fff8e6; border-radius: 6px; padding: 6px 8px;
  color: #7a5b00; font-size: 12px; line-height: 1.5;
}

/* more / collapse */
.wt-more-btn {
  display: block; width: 100%; margin-top: 10px; padding: 6px 0;
  border: none; background: #f6f8fa; color: #4a6cf7;
  border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;
}
.wt-more-btn:hover { background: #eef1fe; }
.wt-more { display: none; }
.wt-more.wt-open { display: block; }

/* footer */
.wt-footer {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  padding: 6px 12px; border-top: 1px solid #f0f0f0;
  color: #8b949e; font-size: 11px;
}
.wt-copy-result.wt-copy-ok { color: #1a7f37; }
.wt-copy-result.wt-copy-err { color: #cf222e; }

/* 底部渐隐：内容可滚动且未滚到底时提示下方还有内容 */
.wt-fade {
  position: sticky; bottom: -1px; height: 22px; margin-top: -22px;
  background: linear-gradient(to bottom, rgba(255,255,255,0), #fff);
  pointer-events: none; opacity: 0; transition: opacity .2s;
}
.wt-fade.wt-fade-on { opacity: 1; }
`;

/* —— 划词后悬浮的翻译按钮（点击才翻译） —— */
const TRIGGER_STYLE = `
:host { all: initial; display: inline-block; }
.wt-trigger {
  display: flex; align-items: center; gap: 6px;
  width: max-content; /* 宽度=内容宽，避免块级按钮撑满整行导致 offsetWidth 测成整页宽 */
  padding: 7px 14px;
  background: #4a6cf7; color: #fff;
  border: none;
  border-radius: 999px;
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px; font-weight: 600; line-height: 1;
  box-shadow: 0 4px 16px rgba(0,0,0,.22), 0 1px 4px rgba(0,0,0,.12);
  cursor: pointer; user-select: none; white-space: nowrap;
  transition: background .15s, transform .12s ease, box-shadow .15s;
}
.wt-trigger:hover { background: #3b5de7; }
.wt-trigger:active { transform: scale(.96); box-shadow: 0 2px 8px rgba(0,0,0,.18); }
.wt-trigger:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
`;

/** 创建元素：el(tag, className, textContent)。text 一律走 textContent，安全无注入。 */
function el(tag, cls, text) {
	const node = document.createElement(tag);
	if (cls) node.className = cls;
	if (text !== undefined && text !== null) node.textContent = text;
	return node;
}

/** 折叠区小节：标题 + 内容节点 */
function section(title, ...children) {
	const s = el("div", "wt-section");
	s.appendChild(el("div", "wt-section-title", title));
	for (const c of children) s.appendChild(c);
	return s;
}

/**
 * 创建悬浮翻译按钮：划词后出现，点击才发起翻译。
 * @param {{ onClick: () => void }} opts
 * @returns {{ root: HTMLElement, el: HTMLElement }}
 */
export function createTrigger({ onClick }) {
	const host = document.createElement("div");
	host.id = "wt-trigger-host";
	const shadow = host.attachShadow({ mode: "open" });
	const style = document.createElement("style");
	style.textContent = TRIGGER_STYLE;
	shadow.appendChild(style);

	const btn = el("button", "wt-trigger");
	btn.type = "button";
	btn.setAttribute("aria-label", "翻译选中的文本");
	btn.appendChild(svgIcon(TRANSLATE_ICON, 16));
	btn.appendChild(el("span", null, "翻译"));
	shadow.appendChild(btn);

	btn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		onClick?.();
	});

	return { root: host, el: btn };
}

/**
 * 创建浮窗卡片。
 * @param {object} opts { granularity, sourceText, onClose, onPin, onRetry, onMove, showAuthor }
 * @returns {{ root: HTMLElement, el: HTMLElement, setContext, updateLoading, renderStream, renderError }}
 */
export function createCard(opts) {
	const host = document.createElement("div");
	host.id = "wt-card-host";
	const shadow = host.attachShadow({ mode: "open" });
	const style = document.createElement("style");
	style.textContent = STYLE;
	shadow.appendChild(style);

	const card = el("div", "wt-card");
	shadow.appendChild(card);

	const { sourceText, onClose, onPin, onRetry, onMove, isActive } = opts;
	let currentSourceText = sourceText;
	let granularity = opts.granularity; // 可变：复用卡片时由 setContext 更新

	// 头部：徽章 + 原文 + 固定/复制/关闭
	const header = el("div", "wt-header");
	header.appendChild(el("span", "wt-badge", BADGE_LABELS[granularity] || ""));
	const srcEl = el("span", "wt-src", sourceText);
	srcEl.title = sourceText;
	header.appendChild(srcEl);
	const pinBtn = el("button", "wt-btn wt-pin");
	pinBtn.type = "button";
	pinBtn.title = "固定";
	pinBtn.setAttribute("aria-label", "固定卡片");
	pinBtn.appendChild(svgIcon(PIN_ICON, 14));
	const copyBtn = el("button", "wt-btn wt-copy-btn");
	copyBtn.type = "button";
	copyBtn.title = "复制译文";
	copyBtn.setAttribute("aria-label", "复制译文");
	copyBtn.appendChild(svgIcon(COPY_ICON, 14));
	const closeBtn = el("button", "wt-btn wt-close", "✕");
	closeBtn.type = "button";
	closeBtn.title = "关闭 (Esc)";
	closeBtn.setAttribute("aria-label", "关闭卡片");
	header.append(pinBtn, copyBtn, closeBtn);

	const body = el("div", "wt-body");

	// 底部渐隐遮罩：可滚动时提示下方还有内容（pointer-events: none 不挡交互）
	const fade = el("div", "wt-fade");

	const footer = el("div", "wt-footer");
	footer.appendChild(el("span", null, "划词翻译"));
	const copyResult = el("span", "wt-copy-result");
	footer.appendChild(copyResult);
	// 作者信息（设置页可开关）
	const author = el("span", "wt-author", "作者 wzukhh | wzukhh@163.com");
	if (opts.showAuthor === false) author.style.display = "none";
	footer.appendChild(author);

	card.append(header, body, fade, footer);

	// 渐隐遮罩：仅当内容可滚动且未滚到底时显示
	function updateFade() {
		const scrollable = card.scrollHeight > card.clientHeight + 4;
		const atBottom =
			card.scrollTop + card.clientHeight >= card.scrollHeight - 8;
		fade.classList.toggle("wt-fade-on", scrollable && !atBottom);
	}
	card.addEventListener("scroll", updateFade, { passive: true });

	let pinned = false;
	let streamMarkdown = null;
	let moreOpen = true;

	// 固定/取消固定
	const setPinned = (force) => {
		if (isActive && !isActive()) { onClose?.(); return; }
		pinned = typeof force === "boolean" ? force : !pinned;
		pinBtn.classList.toggle("wt-pinned", pinned);
		onPin?.(pinned);
	};

	closeBtn.addEventListener("click", () => onClose?.());
	pinBtn.addEventListener("click", () => setPinned());
	copyBtn.addEventListener("click", async () => {
		const clear = () => {
			copyResult.textContent = "";
			copyResult.className = "wt-copy-result";
		};
		try {
			const markdown = `# ${BADGE_LABELS[granularity] || "翻译"} · ${currentSourceText}\n\n${streamMarkdown || ""}`;
			await navigator.clipboard.writeText(markdown);
			copyResult.textContent = "已复制";
			copyResult.classList.add("wt-copy-ok");
		} catch {
			copyResult.textContent = "复制失败";
			copyResult.classList.add("wt-copy-err");
		}
		setTimeout(clear, 1500);
	});

	// —— 拖拽移动：按住头部拖动整卡 ——
	let dragState = null;
	header.addEventListener("mousedown", (e) => {
		if (e.button !== 0) return;
		if (e.target.closest(".wt-btn")) return; // 按钮不触发拖拽
		const r = host.getBoundingClientRect();
		dragState = {
			startX: e.clientX,
			startY: e.clientY,
			origLeft: r.left,
			origTop: r.top,
		};
		e.preventDefault(); // 防止拖动时选中文本
	});
	window.addEventListener("mousemove", (e) => {
		if (!dragState) return;
		const x = Math.max(
			0,
			Math.min(
				dragState.origLeft + e.clientX - dragState.startX,
				window.innerWidth - host.offsetWidth,
			),
		);
		const y = Math.max(
			0,
			Math.min(
				dragState.origTop + e.clientY - dragState.startY,
				window.innerHeight - host.offsetHeight,
			),
		);
		host.style.left = `${x}px`;
		host.style.top = `${y}px`;
		onMove?.();
	});
	window.addEventListener("mouseup", () => {
		dragState = null;
	});

	return {
		root: host,
		el: card,
		/** 切换页脚作者信息显示 */
		setShowAuthor(show) {
			author.style.display = show ? "" : "none";
		},
		/** 更新粒度与原文（复用卡片时调用） */
		setContext(g, source) {
			granularity = g;
			currentSourceText = source;
			streamMarkdown = null;
			moreOpen = true;
			card.querySelector(".wt-badge").textContent = BADGE_LABELS[g] || "";
			srcEl.textContent = source;
			srcEl.title = source;
		},
		updateLoading() {
			streamMarkdown = null;
			body.replaceChildren();
			const loading = el("div", "wt-loading");
			loading.appendChild(el("div", "wt-spinner"));
			loading.appendChild(el("span", null, "正在翻译…"));
			body.appendChild(loading);
			updateFade();
		},
		renderStream(markdown, { complete = false, warning = "" } = {}) {
			streamMarkdown = markdown;
			const parsed = parseCardMarkdown(markdown, granularity);
			granularity = parsed.type;
			card.querySelector(".wt-badge").textContent = BADGE_LABELS[parsed.type] || "翻译";
			const view = renderMarkdownCard(parsed, () => moreOpen, (open) => { moreOpen = open; });
			if (!complete && !warning) {
				const status = el("div", "wt-stream-status");
				status.append(el("span", "wt-spinner"), el("span", null, "正在生成…"));
				view.appendChild(status);
			}
			if (warning) {
				const notice = el("div", "wt-stream-warning", warning);
				const retry = el("span", "wt-retry", "重试");
				retry.addEventListener("click", () => onRetry?.());
				notice.appendChild(retry);
				view.appendChild(notice);
			}
			body.replaceChildren(view);
			updateFade();
		},
		renderError(message) {
			body.replaceChildren();
			const err = el("div", "wt-error");
			err.appendChild(document.createTextNode(`⚠️ ${message}`));
			const retry = el("span", "wt-retry", "重试");
			retry.addEventListener("click", () => onRetry?.());
			err.appendChild(retry);
			body.appendChild(err);
			updateFade();
		},
	};
}

/** 固定栏目负责版式；栏目内容只解析安全的 Markdown 子集。 */
function renderMarkdownCard(parsed, getMoreOpen, setMoreOpen) {
	const wrap = el("div", "wt-md");
	const extras = [];
	const primaryTitles = parsed.type === "word"
		? ["音标", "释义"]
		: parsed.type === "phrase" ? ["翻译", "解释"] : ["翻译", "语气"];
	const hasKnownPrimary = parsed.sections.some((entry) => primaryTitles.includes(entry.title));
	for (const [index, entry] of parsed.sections.entries()) {
		const primary = primaryTitles.includes(entry.title) || (!hasKnownPrimary && index === 0);
		const block = parsed.type === "word" && entry.title === "释义"
			? renderWordDefinitions(entry.lines) : renderMarkdownBlock(entry.lines);
		if (primary) {
			const cls = entry.title === "音标" ? "wt-phonetic"
				: entry.title === "翻译" ? "wt-md-primary"
				: entry.title === "解释" || entry.title === "语气" ? "wt-explanation"
				: entry.title === "释义" ? "wt-md-defs" : "wt-md-primary";
			block.classList.add(cls);
			wrap.appendChild(block);
		} else {
			if (entry.title === "背景知识") block.classList.add("wt-bg-note");
			extras.push(section(entry.title, block));
		}
	}
	if (extras.length) {
		const btn = el("button", "wt-more-btn", getMoreOpen() ? "收起 ▴" : "更多 ▾");
		const more = el("div", getMoreOpen() ? "wt-more wt-open" : "wt-more");
		for (const extra of extras) more.appendChild(extra);
		btn.addEventListener("click", () => {
			const open = more.classList.toggle("wt-open");
			setMoreOpen(open);
			btn.textContent = open ? "收起 ▴" : "更多 ▾";
		});
		wrap.append(btn, more);
	}
	return wrap;
}

function renderWordDefinitions(lines) {
	const block = el("div");
	for (const line of lines) {
		const match = line.match(/^\s*[-*]\s+\*\*(.+?)\*\*\s*(.+)$/);
		if (!match) { block.appendChild(renderMarkdownBlock([line])); continue; }
		const row = el("div", "wt-pos-item");
		row.appendChild(el("span", "wt-pos-tag", match[1]));
		const [definition, examplePart] = match[2].split(/例[:：]/, 2);
		const def = el("span", "wt-def");
		appendMarkdownInline(def, definition.trim());
		row.appendChild(def);
		if (examplePart) {
			const [example, translation] = examplePart.split(/译[:：]/, 2);
			const ex = el("div", "wt-example");
			ex.appendChild(document.createTextNode("e.g. "));
			appendMarkdownInline(ex, example.trim());
			if (translation) ex.appendChild(el("span", "wt-example-zh", ` —— ${translation.trim()}`));
			row.appendChild(ex);
		}
		block.appendChild(row);
	}
	return block;
}

function renderMarkdownBlock(lines) {
	const block = el("div");
	let list = null;
	let paragraph = null;
	for (const line of lines) {
		const value = line.trim();
		if (!value) { list = null; paragraph = null; continue; }
		const bullet = value.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
		if (bullet) {
			paragraph = null;
			if (!list) { list = el("ul", "wt-ul"); block.appendChild(list); }
			const item = el("li");
			appendMarkdownInline(item, bullet[1]);
			list.appendChild(item);
			continue;
		}
		list = null;
		if (value.startsWith("> ")) {
			paragraph = null;
			const quote = el("blockquote");
			appendMarkdownInline(quote, value.slice(2));
			block.appendChild(quote);
			continue;
		}
		if (!paragraph) { paragraph = el("p"); block.appendChild(paragraph); }
		else paragraph.appendChild(document.createTextNode(" "));
		appendMarkdownInline(paragraph, value);
	}
	return block;
}

/** 只解释加粗、斜体、行内代码；其余文本始终走 textContent。 */
function appendMarkdownInline(parent, value) {
	const pattern = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|`([^`]+)`)/g;
	let start = 0;
	for (const match of value.matchAll(pattern)) {
		if (match.index > start) parent.appendChild(document.createTextNode(value.slice(start, match.index)));
		const tag = match[2] || match[3] ? "strong" : match[4] ? "em" : "code";
		parent.appendChild(el(tag, null, match[2] || match[3] || match[4] || match[5]));
		start = match.index + match[0].length;
	}
	if (start < value.length) parent.appendChild(document.createTextNode(value.slice(start)));
}
