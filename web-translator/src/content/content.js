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
let showAuthor = true; // 页脚作者信息开关

// 读取设置并监听变更（设置页中途改开关，已打开的卡片实时生效）
if (chrome?.storage?.local) {
	chrome.storage.local.get({ showAuthor: true }, (cfg) => {
		showAuthor = !!cfg.showAuthor;
	});
	chrome.storage.onChanged.addListener((changes, area) => {
		if (area !== "local" || !("showAuthor" in changes)) return;
		showAuthor = !!changes.showAuthor.newValue;
		card?.setShowAuthor(showAuthor);
	});
}

function onMouseUp(event) {
	// 点击/划选了浮窗或按钮自身不处理（shadow DOM 内元素需用 composedPath 判定）
	if (card && event.composedPath().includes(card.root)) return;
	if (trigger && event.composedPath().includes(trigger.root)) return;
	// 稍等 selection 稳定
	setTimeout(() => {
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
			onClose: hideCard,
			onPin: (p) => {
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
	positionCard(rect);
	requestTranslate(text);
}

function requestTranslate(text) {
	if (!card) return;
	// 防御：chrome.runtime 不可用（测试页环境 / 扩展重载后旧页面残留的 content script）
	if (!chrome?.runtime?.sendMessage) {
		card.renderError(
			"无法调用扩展后台：请刷新页面后重试（若刚重载过扩展，刷新页面即可）",
		);
		return;
	}
	const id = ++requestId;
	card.updateLoading();
	positionCard(lastRect);
	const granularity = detectGranularity(text);
	chrome.runtime.sendMessage(
		{ type: "translate", text, granularity },
		(resp) => {
			if (id !== requestId) return; // 过期响应丢弃
			if (chrome.runtime.lastError) {
				card.renderError(chrome.runtime.lastError.message);
			} else if (!resp?.ok) {
				card.renderError(resp?.error || "翻译失败");
			} else {
				card.renderResult(resp.data);
			}
			// 结果渲染后卡片尺寸可能变化，重新定位避免溢出
			positionCard(lastRect);
		},
	);
}

function positionCard(rect) {
	// 用户手动拖拽移动后不再自动定位（同一文本的渲染/重试都不挪动）
	if (dragged) return;
	const margin = 12;
	const w = card.el.offsetWidth || 380; // 测量卡片本体，尺寸更准确
	const h = card.el.offsetHeight || 200;
	// 固定屏幕正中心，避免弹窗随选区位置跳动
	let x = (window.innerWidth - w) / 2;
	let y = (window.innerHeight - h) / 2;
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
