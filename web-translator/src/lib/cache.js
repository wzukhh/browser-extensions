/**
 * 会话级翻译缓存（background 中使用）。
 * 基于 chrome.storage.session：数据存内存，浏览器关闭/重启自动清空，
 * 但 service worker 重启不丢（正是"同一浏览器生命周期"的语义）。
 * 上限 1000 条，超出按 LRU 截取最旧记录。
 */

const ORDER_KEY = "__order";
const PREFIX = "c:";
const MAX_ENTRIES = 1000;

export function cacheKey(text, granularity, targetLang) {
	return `${targetLang}:${granularity}:${text}`;
}

async function readOrder() {
	const data = await chrome.storage.session.get(ORDER_KEY);
	return data[ORDER_KEY] || [];
}

export async function getCache(key) {
	try {
		const skey = PREFIX + key;
		const data = await chrome.storage.session.get([ORDER_KEY, skey]);
		const entry = data[skey];
		if (!entry) return null;
		// LRU：命中的 key 挪到最新（数组末尾）
		const order = data[ORDER_KEY] || [];
		const idx = order.indexOf(key);
		if (idx !== order.length - 1) {
			if (idx > -1) order.splice(idx, 1);
			order.push(key);
			await chrome.storage.session.set({ [ORDER_KEY]: order });
		}
		return entry.value;
	} catch {
		return null;
	}
}

export async function putCache(key, value) {
	try {
		const skey = PREFIX + key;
		const order = await readOrder();
		const idx = order.indexOf(key);
		if (idx > -1) order.splice(idx, 1);
		order.push(key);

		// 超限截取：删掉最旧的
		const excess = order.length - MAX_ENTRIES;
		const evicted = excess > 0 ? order.splice(0, excess) : [];

		await chrome.storage.session.set({
			[ORDER_KEY]: order,
			[skey]: { value },
		});
		if (evicted.length) {
			await chrome.storage.session.remove(evicted.map((k) => PREFIX + k));
		}
	} catch {
		// 缓存失败不影响主流程
	}
}
