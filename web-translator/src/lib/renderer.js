/**
 * 浮窗卡片渲染器：把 LLM 返回的分级 JSON 渲染成紧凑卡片。
 * 使用 Shadow DOM 隔离样式，避免被页面 CSS 污染。
 *
 * 信息架构（"详细但不啰嗦"）：
 *  - 默认层：核心信息（词条释义 / 短语含义 / 句子翻译 / 段落概括+翻译）
 *  - 更多层：展开语法批注、生词、习语、词根等深度内容
 *
 * 全部用 DOM API 构建节点（textContent），不用 innerHTML，杜绝注入面。
 */

import { GRANULARITY } from "./granularity.js";
import { svgIcon, PIN_ICON, COPY_ICON, TRANSLATE_ICON } from "./icons.js";

const WIDTH = 380;
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
  max-height: 480px;
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
 * 圆点列表。
 * row 可以是字符串（纯文本行），或 { cls, parts: [{ cls, text, bold, sep }] }：
 *  sep 为节点前的分隔文本；bold 用 <b> 渲染。
 */
function ulList(rows) {
	const ul = el("ul", "wt-ul");
	for (const row of rows) {
		const li = document.createElement("li");
		if (typeof row === "string") {
			li.textContent = row;
		} else {
			if (row.cls) li.className = row.cls;
			for (const part of row.parts || []) {
				if (part.sep) li.appendChild(document.createTextNode(part.sep));
				const node = part.bold
					? document.createElement("b")
					: document.createElement("span");
				if (part.cls) node.className = part.cls;
				if (part.text !== undefined) node.textContent = part.text;
				li.appendChild(node);
			}
		}
		ul.appendChild(li);
	}
	return ul;
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
 * @returns {{ root: HTMLElement, el: HTMLElement, setContext, updateLoading, renderResult, renderError }}
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

	const { sourceText, onClose, onPin, onRetry, onMove } = opts;
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
	let lastData = null; // 最近一次渲染的译文数据，供复制使用

	// 固定/取消固定
	const setPinned = (force) => {
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
			await navigator.clipboard.writeText(
				buildCardMarkdown(sourceText, lastData?.type || granularity, lastData),
			);
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
			lastData = null; // 新原文到来，旧译文失效
			card.querySelector(".wt-badge").textContent = BADGE_LABELS[g] || "";
			srcEl.textContent = source;
			srcEl.title = source;
		},
		updateLoading() {
			lastData = null;
			body.replaceChildren();
			const loading = el("div", "wt-loading");
			loading.appendChild(el("div", "wt-spinner"));
			loading.appendChild(el("span", null, "正在翻译…"));
			body.appendChild(loading);
			updateFade();
		},
		renderResult(data) {
			lastData = data;
			// 模型自行判断的粒度：同步徽章并按其渲染
			const type = normalizeType(data?.type, granularity);
			card.querySelector(".wt-badge").textContent = BADGE_LABELS[type] || "";
			const frag = renderByGranularity(type, data);
			body.replaceChildren(frag);
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

/** 校验/归一化粒度：优先模型返回的 type，非法则回落客户端启发式 */
function normalizeType(type, fallback) {
	const valid = [GRANULARITY.WORD, GRANULARITY.PHRASE, GRANULARITY.SENTENCE];
	if (valid.includes(type)) return type;
	if (valid.includes(fallback)) return fallback;
	return GRANULARITY.SENTENCE;
}

function renderByGranularity(granularity, d) {
	const wrap = document.createElement("div");
	if (granularity === GRANULARITY.WORD) return renderWord(wrap, d);
	if (granularity === GRANULARITY.PHRASE) return renderPhrase(wrap, d);
	if (granularity === GRANULARITY.SENTENCE) return renderSentence(wrap, d);
	return wrap;
}

function renderWord(wrap, d) {
	if (d.phonetic) wrap.appendChild(el("div", "wt-phonetic", d.phonetic));
	for (const item of d.pos || []) {
		const row = el("div", "wt-pos-item");
		row.appendChild(el("span", "wt-pos-tag", item.pos || ""));
		row.appendChild(el("span", "wt-def", item.def || ""));
		if (item.example) {
			const ex = el("div", "wt-example");
			ex.appendChild(document.createTextNode("e.g. "));
			appendFormatted(ex, item.example); // **单词** 加粗展示
			if (item.exampleZh) {
				ex.appendChild(document.createTextNode(" —— "));
				ex.appendChild(el("span", "wt-example-zh", item.exampleZh));
			}
			row.appendChild(ex);
		}
		wrap.appendChild(row);
	}
	const extra = [];
	if (d.roots) extra.push(section("词根词缀", el("div", null, d.roots)));
	if (d.memory) extra.push(section("记忆点", el("div", null, d.memory)));
	appendMore(wrap, extra);
	return wrap;
}

function renderPhrase(wrap, d) {
	wrap.appendChild(el("div", "wt-translation", d.translation || ""));
	if (d.explanation)
		wrap.appendChild(el("div", "wt-explanation", d.explanation));
	const extra = [];
	if (d.examples?.length) extra.push(section("例句", ulList(d.examples)));
	if (d.usage) extra.push(section("使用场景", el("div", null, d.usage)));
	appendMore(wrap, extra);
	return wrap;
}

function renderSentence(wrap, d) {
	wrap.appendChild(el("div", "wt-translation", d.translation || ""));
	if (d.tone) wrap.appendChild(el("div", "wt-explanation", d.tone));
	const extra = [];
	if (d.grammar?.length) extra.push(section("语法批注", ulList(d.grammar)));
	if (d.vocab?.length) {
		extra.push(
			section(
				"生词",
				ulList(
					d.vocab.map((v) => ({
						cls: "wt-vocab",
						parts: [
							{ cls: "w", text: v.word || "" },
							...(v.phonetic ? [{ cls: "ph", text: v.phonetic }] : []),
							{ sep: " — ", text: v.meaning || "" },
						],
					})),
				),
			),
		);
	}
	// 短语/固定搭配/习语（兼容旧字段 idioms）
	const phrases = d.phrases?.length ? d.phrases : d.idioms;
	if (phrases?.length) {
		extra.push(
			section(
				"短语搭配",
				ulList(
					phrases.map((p) => ({
						parts: [
							{ bold: true, text: p.phrase || "" },
							{ sep: " — ", text: p.meaning || "" },
						],
					})),
				),
			),
		);
	}
	// 背景知识：文化梗/典故/特殊含义
	if (d.background) {
		extra.push(
			section("背景知识", el("div", "wt-bg-note", `💡 ${d.background}`)),
		);
	}
	appendMore(wrap, extra);
	return wrap;
}

/** "更多"折叠区：默认展开，可手动收起 */
function appendMore(wrap, sections) {
	if (!sections?.length) return;
	const btn = el("button", "wt-more-btn", "收起 ▴");
	const more = el("div", "wt-more wt-open"); // 默认展开
	for (const s of sections) more.appendChild(s);
	btn.addEventListener("click", () => {
		const open = more.classList.toggle("wt-open");
		btn.textContent = open ? "收起 ▴" : "更多 ▾";
	});
	wrap.appendChild(btn);
	wrap.appendChild(more);
}

/**
 * 把 **加粗** 标记的文本渲染进 parent（模型约定用 ** 包裹被解释的单词）。
 */
function appendFormatted(parent, text) {
	const parts = String(text || "").split(/\*\*(.+?)\*\*/g);
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (!part) continue;
		if (i % 2 === 1) {
			const b = document.createElement("b");
			b.textContent = part;
			parent.appendChild(b);
		} else {
			parent.appendChild(document.createTextNode(part));
		}
	}
}

/**
 * 把整张卡片内容转成纯文本（供「复制译文」按钮使用）。
 */
/**
 * 把整张卡片内容转成 Markdown（供「复制译文」按钮使用）。
 * 模型例句中的 **加粗** 标记即 Markdown 加粗，直接复用。
 */
function buildCardMarkdown(sourceText, granularity, d) {
	const badge = BADGE_LABELS[granularity] || "";
	const lines = [`# ${badge} · ${sourceText}`];
	if (!d) return lines.join("\n");
	if (granularity === GRANULARITY.WORD) {
		if (d.phonetic) lines.push(`\n**音标**：${d.phonetic}`);
		for (const item of d.pos || []) {
			lines.push(`\n**${item.pos || ""}** ${item.def || ""}`);
			if (item.example) {
				lines.push(
					`> 例：${item.example}${item.exampleZh ? ` —— ${item.exampleZh}` : ""}`,
				);
			}
		}
		if (d.roots) lines.push(`\n**词根词缀**：${d.roots}`);
		if (d.memory) lines.push(`\n**记忆点**：${d.memory}`);
	} else if (granularity === GRANULARITY.PHRASE) {
		lines.push(`\n**含义**：${d.translation || ""}`);
		if (d.explanation) lines.push(`**解释**：${d.explanation}`);
		if (d.examples?.length) {
			lines.push("\n**例句**：");
			for (const e of d.examples) lines.push(`- ${e}`);
		}
		if (d.usage) lines.push(`\n**使用场景**：${d.usage}`);
	} else if (granularity === GRANULARITY.SENTENCE) {
		lines.push(`\n**翻译**：${d.translation || ""}`);
		if (d.tone) lines.push(`**语气**：${d.tone}`);
		if (d.grammar?.length) {
			lines.push("\n**语法批注**：");
			for (const g of d.grammar) lines.push(`- ${g}`);
		}
		if (d.vocab?.length) {
			lines.push("\n**生词**：");
			for (const v of d.vocab)
				lines.push(
					`- **${v.word || ""}**${v.phonetic ? ` ${v.phonetic}` : ""} — ${v.meaning || ""}`,
				);
		}
		// 短语/固定搭配/习语（兼容旧字段 idioms）
		const phrasesList = d.phrases?.length ? d.phrases : d.idioms;
		if (phrasesList?.length) {
			lines.push("\n**短语搭配**：");
			for (const p of phrasesList)
				lines.push(`- **${p.phrase || ""}** — ${p.meaning || ""}`);
		}
		if (d.background) lines.push(`\n**背景知识**：💡 ${d.background}`);
	}
	return lines.join("\n");
}
