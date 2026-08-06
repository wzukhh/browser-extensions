/**
 * Service Worker：处理 content script 的翻译请求。
 * 流程：查缓存 → 命中直接返回；未命中 → 调 DeepSeek → 写缓存 → 返回。
 */

import { buildSystemPrompt, sanitizeResult } from "../lib/prompt-builder.js";
import { translate, getConfig } from "../lib/api.js";
import { cacheKey, getCache, putCache } from "../lib/cache.js";
import { normalizeText, detectGranularity } from "../lib/granularity.js";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
	if (msg?.type !== "translate") return;

	handleTranslate(msg).then(
		(resp) => sendResponse(resp),
		(err) => sendResponse({ ok: false, error: err.message || String(err) }),
	);
	return true; // 异步响应
});

async function handleTranslate({ text, granularity }) {
	const config = await getConfig();
	const clean = normalizeText(text);
	const g = granularity || detectGranularity(clean);

	const key = cacheKey(clean, g, config.targetLang);
	const cached = await getCache(key);
	if (cached) return { ok: true, data: cached, fromCache: true };

	// 统一大而全提示词：模型自行判断粒度（g 仅作缓存键与 type 兑底）
	const systemPrompt = buildSystemPrompt(clean, config.targetLang);
	let raw;
	try {
		raw = await translate(systemPrompt, clean, config);
	} catch (err) {
		if (err.code === "NO_API_KEY") {
			return { ok: false, error: err.message };
		}
		throw err;
	}

	const data = sanitizeResult(g, raw);
	await putCache(key, data);
	return { ok: true, data, fromCache: false };
}
