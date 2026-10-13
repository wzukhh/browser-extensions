/**
 * 内容脚本：划词后悬浮「翻译」按钮，点击才弹出翻译卡片。
 *
 * 交互设计：
 *  - mouseup 选中文本 → 在选区旁悬浮「📖 翻译」按钮（不自动翻译）
 *  - 点击按钮 → 弹出翻译卡片（自动判断粒度：单词/短语/句子/段落）
 *  - 关闭：Esc / 点击浮窗外部 / 滚动页面 / 重新划选
 *  - 固定：📌 按钮让浮窗不随操作消失（配合重新划词更新内容）
 *  - 任意网站可用（manifest content_scripts 匹配 <all_urls>）
 */

import { normalizeText, detectGranularity } from "../lib/granularity.js";
import { createCard, createTrigger } from "../lib/renderer.js";

const MIN_LEN = 2;
const MAX_LEN = 2000;

let card = null;
let trigger = null;
let pinned = false;
let dragged = false; // 用户手动拖拽移动过卡片后，不再自动定位
let lastRect = null;
let currentText = null;
let requestId = 0; // 防止慢响应覆盖新请求结果
let activePort = null;
let showAuthor = true; // 页脚作者信息开关
let showSelectionButton = true;

function runtimeAvailable() {
	try { return !!(chrome?.runtime?.id && chrome.runtime.connect); }
	catch { return false; }
}

function disconnectPort(port) {
	if (!port) return;
	try { port.disconnect(); }
	catch { /* 扩展重载后 Port 可能已经失效 */ }
}

// 读取设置并监听变更（设置页中途改开关，已打开的卡片实时生效）
if (chrome?.storage?.local) {
	chrome.storage.local.get({ showAuthor: true, showSelectionButton: true }, (cfg) => {
		showAuthor = !!cfg.showAuthor;
		showSelectionButton = cfg.showSelectionButton !== false;
		if (!showSelectionButton) hideTrigger();
	});
	chrome.storage.onChanged.addListener((changes, area) => {
		if (area !== "local") return;
		if ("showAuthor" in changes) {
			showAuthor = !!changes.showAuthor.newValue;
			card?.setShowAuthor(showAuthor);
		}
		if ("showSelectionButton" in changes) {
			showSelectionButton = changes.showSelectionButton.newValue !== false;
			if (!showSelectionButton) hideTrigger();
		}
	});
}

function onMouseUp(event) {
	if (!runtimeAvailable()) { hideAll(); return; }
	if (event.button !== 0 || !showSelectionButton) return;
	// 点击/划选了浮窗或按钮自身不处理（shadow DOM 内元素需用 composedPath 判定）
	if (card && event.composedPath().includes(card.root)) return;
	if (trigger && event.composedPath().includes(trigger.root)) return;
	// 稍等 selection 稳定
	setTimeout(() => {
		if (!showSelectionButton) return;
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

		const raw = sel.toString();
		const text = normalizeText(raw);
		if (text.length < MIN_LEN || text.length > MAX_LEN) return;

		const rect = sel.getRangeAt(0).getBoundingClientRect();
		if (rect.width === 0 && rect.height === 0) return;

		const granularity = detectGranularity(text);
		if (!granularity) return;

		currentText = text;
		lastRect = rect;
		// 只悬浮翻译按钮，翻译在点击后进行
		showTrigger(rect);
	}, 10);
}

// —— 翻译按钮 ——

function showTrigger(rect) {
	if (!trigger) {
		trigger = createTrigger({
			onClick: () => {
				hideTrigger();
				if (!currentText || !lastRect) return;
				showCard(currentText, detectGranularity(currentText), lastRect);
			},
		});
		document.documentElement.appendChild(trigger.root);
	}
	positionTrigger(rect);
}

function hideTrigger() {
	if (trigger) {
		trigger.root.remove();
		trigger = null;
	}
}

function positionTrigger(rect) {
	const margin = 8;
	const w = trigger.el.offsetWidth || 74;
	const h = trigger.el.offsetHeight || 27;
	// 整个选区矩形（getBoundingClientRect 返回全部行的并集，不是首/尾行）
	const xMin = rect.left;
	const xMax = rect.right;
	// 按钮中心 x = 选区中心 x（x-min 与 x-max 的中点）
	let x = (xMin + xMax) / 2 - w / 2;
	let y = rect.top - h - margin;

	// 上方放不下则翻到选区下方
	if (y < margin) y = rect.bottom + margin;
	// 水平/垂直都钳制在视口内（rect 是视口坐标，fixed 定位无需 scroll 换算）
	x = Math.max(margin, Math.min(x, window.innerWidth - w - margin));
	y = Math.max(margin, Math.min(y, window.innerHeight - h - margin));

	trigger.root.style.position = "fixed";
	trigger.root.style.left = `${x}px`;
	trigger.root.style.top = `${y}px`;
	trigger.root.style.zIndex = "2147483647";
}

// —— 翻译卡片 ——

function showCard(text, granularity, rect) {
	if (!card) {
		card = createCard({
			granularity,
			sourceText: text,
			showAuthor,
			isActive: runtimeAvailable,
			onClose: hideCard,
			onPin: (p) => {
				if (!runtimeAvailable()) { hideCard(); return; }
				pinned = p;
			},
			onRetry: () => requestTranslate(currentText),
			onMove: () => {
				dragged = true; // 用户拖拽过，停止自动定位（关闭只靠点外部/✕/Esc）
			},
		});
		document.documentElement.appendChild(card.root);
	}
	// 新划词翻译时重置拖拽状态，让卡片重新吸附到新选区
	dragged = false;
	// 复用卡片时同步更新原文、粒度徽章与渲染布局
	card.setContext(granularity, text);
	requestTranslate(text);
}

function requestTranslate(text) {
	if (!card) return;
	// 防御：扩展重载后旧页面可能留下失效的 content script。
	if (!runtimeAvailable()) {
		card.renderError(
			"无法调用扩展后台：请刷新页面后重试（若刚重载过扩展，刷新页面即可）",
		);
		return;
	}
	if (activePort) { disconnectPort(activePort); activePort = null; }
	const id = ++requestId;
	card.updateLoading();
	const granularity = detectGranularity(text);
	positionCard(lastRect, { expectGrowth: true });
	let markdown = "";
	let settled = false;
	let port;
	try { port = chrome.runtime.connect({ name: "translate-stream" }); }
	catch (err) { card.renderError(err.message || "无法连接扩展后台"); return; }
	activePort = port;
	port.onMessage.addListener((msg) => {
		if (id !== requestId || !card) return;
		if (!runtimeAvailable()) { hideAll(); return; }
		if (msg.type === "delta") {
			markdown += msg.text || "";
			card.renderStream(markdown);
		} else if (msg.type === "done") {
			settled = true;
			if (msg.data?.format === "markdown") {
				card.renderStream(msg.data.markdown, {
					complete: true,
					warning: msg.incomplete ? "回答达到长度上限，以下内容可能未完成。" : "",
				});
			} else {
				card.renderError("收到未知响应格式，请重试");
			}
			disconnectPort(port);
			activePort = null;
		} else if (msg.type === "error") {
			settled = true;
			if (markdown.trim()) card.renderStream(markdown, { complete: true, warning: `生成中断：${msg.error}` });
			else card.renderError(msg.error || "翻译失败");
			disconnectPort(port);
			activePort = null;
		}
		positionCard(lastRect, { keepTop: true });
	});
	port.onDisconnect.addListener(() => {
		if (id !== requestId || settled || !card) return;
		activePort = null;
		const reason = runtimeAvailable() ? "连接中断，请重试。" : "扩展已重新加载，请刷新此网页后重试。";
		if (markdown.trim()) card.renderStream(markdown, { complete: true, warning: reason });
		else card.renderError(reason);
	});
	try { port.postMessage({ type: "translate", text, granularity }); }
	catch {
		settled = true;
		activePort = null;
		disconnectPort(port);
		card.renderError("扩展连接已失效，请刷新此网页后重试");
	}
}

function positionCard(rect, { expectGrowth = false, keepTop = false } = {}) {
	// 用户手动拖拽移动后不再自动定位（同一文本的渲染/重试都不挪动）
	if (dragged) return;
	const margin = 12;
	const w = card.el.offsetWidth || 440; // 测量卡片本体，尺寸更准确
	const actualHeight = card.el.offsetHeight || 200;
	const maxHeight = Math.min(window.innerHeight * 0.7, window.innerHeight - 24);
	const h = expectGrowth ? Math.max(actualHeight, maxHeight) : actualHeight;
	// 固定屏幕正中心，避免弹窗随选区位置跳动
	let x = (window.innerWidth - w) / 2;
	let y = keepTop ? Number.parseFloat(card.root.style.top) || margin : (window.innerHeight - h) / 2;
	// 钳制在视口内（超大卡片/窄视口兜底）
	x = Math.max(margin, Math.min(x, window.innerWidth - w - margin));
	y = Math.max(margin, Math.min(y, window.innerHeight - h - margin));

	// 定位到 host，fixed 使拖拽可用视口坐标直算
	card.root.style.position = "fixed";
	card.root.style.left = `${x}px`;
	card.root.style.top = `${y}px`;
	card.root.style.zIndex = "2147483647";
}

function hideCard() {
	requestId++;
	if (activePort) { disconnectPort(activePort); activePort = null; }
	if (card) {
		card.root.remove();
		card = null;
	}
	pinned = false;
	dragged = false;
}

function hideAll() {
	hideTrigger();
	hideCard();
}

// —— 事件绑定 ——

document.addEventListener("mouseup", onMouseUp);

chrome.runtime.onMessage.addListener((message) => {
	if (message?.type !== "translate-selection" || !runtimeAvailable()) return;
	const text = normalizeText(message.text || "");
	if (text.length < MIN_LEN || text.length > MAX_LEN) return;
	const selection = window.getSelection();
	const rect = selection?.rangeCount && !selection.isCollapsed
		? selection.getRangeAt(0).getBoundingClientRect()
		: { left: window.innerWidth / 2, right: window.innerWidth / 2,
			top: window.innerHeight / 2, bottom: window.innerHeight / 2 };
	hideTrigger();
	currentText = text;
	lastRect = rect;
	showCard(text, detectGranularity(text), rect);
});

document.addEventListener("keydown", (e) => {
	if (e.key === "Escape" && (card || trigger)) hideAll();
});

// 点击浮窗/按钮外部关闭（shadow DOM 内点击用 composedPath 判定）
document.addEventListener("mousedown", (e) => {
	if (card && e.composedPath().includes(card.root)) return;
	if (trigger && e.composedPath().includes(trigger.root)) return;
	hideTrigger();
	// 固定中的卡片不随外部点击关闭
	if (!pinned) hideCard();
});

// 滚动只隐藏临时翻译按钮，不关闭弹窗（弹窗只在点击外部 / ✕ / Esc 时关闭）
window.addEventListener(
	"scroll",
	() => {
		hideTrigger();
	},
	true,
);

// 页面卸载前清理
window.addEventListener("pagehide", hideAll);
