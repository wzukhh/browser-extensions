/** Service Worker：每次请求模型，并经 Port 转发翻译流。 */
import { buildSystemPrompt } from "../lib/prompt-builder.js";
import { translateStream, getConfig } from "../lib/api.js";
import { normalizeText, detectGranularity } from "../lib/granularity.js";
import { parseCardMarkdown } from "../lib/markdown-card.js";

const CONTEXT_MENU_ID = "translate-selection";
chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.removeAll(() => {
		chrome.contextMenus.create({
			id: CONTEXT_MENU_ID,
			title: "翻译选中文本",
			contexts: ["selection"],
		});
	});
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
	if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id || !info.selectionText) return;
	chrome.tabs.sendMessage(tab.id, {
		type: "translate-selection",
		text: info.selectionText,
	}, () => { void chrome.runtime.lastError; });
});

chrome.runtime.onConnect.addListener((port) => {
	if (port.name !== "translate-stream") return;
	const controller = new AbortController();
	let disconnected = false;
	let started = false;
	port.onDisconnect.addListener(() => {
		disconnected = true;
		controller.abort();
	});
	const send = (msg) => { if (!disconnected) port.postMessage(msg); };
	port.onMessage.addListener(async (msg) => {
		if (started || msg?.type !== "translate") return;
		started = true;
		try {
			const config = await getConfig();
			const clean = normalizeText(msg.text);
			if (!clean) throw new Error("选中文本为空");
			const g = msg.granularity || detectGranularity(clean);
			if (disconnected) return;
			let pending = "";
			let timer = null;
			const flush = () => {
				if (timer) clearTimeout(timer);
				timer = null;
				if (pending) { send({ type: "delta", text: pending }); pending = ""; }
			};
			try {
				const result = await translateStream(buildSystemPrompt(), clean, config, {
					signal: controller.signal,
					onDelta(delta) {
						pending += delta;
						if (pending.length >= 120) flush();
						else if (!timer) timer = setTimeout(flush, 60);
					},
				});
				flush();
				if (!parseCardMarkdown(result.content, g).sections.length) {
					throw new Error("模型没有返回可展示的译文，请重试");
				}
				const complete = result.finishReason === "stop";
				const data = { format: "markdown", markdown: result.content };
				send({ type: "done", data, incomplete: !complete });
			} catch (err) {
				flush(); // 中断时仍展示尚未达到批量阈值的最后几个字
				throw err;
			} finally {
				if (timer) clearTimeout(timer);
			}
		} catch (err) {
			if (!disconnected && err.name !== "AbortError") {
				send({ type: "error", error: err.message || String(err) });
			}
		}
	});
});
