/**
 * DeepSeek API 调用（background 中使用）。
 * 设置项存 chrome.storage.local，模型与 baseUrl 可配置，方便换其他兼容 OpenAI 的供应商。
 */

const DEFAULT_CONFIG = {
	apiKey: "",
	baseUrl: "https://api.deepseek.com",
	model: "",
	targetLang: "zh-CN",
	maxTokens: 4096,
};

/** 读取设置（默认值兜底） */
export async function getConfig() {
	const stored = await chrome.storage.local.get(DEFAULT_CONFIG);
	return { ...DEFAULT_CONFIG, ...stored };
}

/** 读取 Chat Completions SSE。网络分块与事件边界没有对应关系。 */
export async function translateStream(systemPrompt, text, config, { signal, onDelta }) {
	const { apiKey, baseUrl, model, maxTokens } = config;
	if (!apiKey) {
		const err = new Error("未配置 API Key，请点击工具栏图标打开设置");
		err.code = "NO_API_KEY";
		throw err;
	}
	if (!model) {
		throw new Error("未选择模型，请打开设置加载并选择模型");
	}

	const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
		method: "POST",
		signal,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model,
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: text },
			],
			temperature: 0.3,
			max_tokens: maxTokens,
			stream: true,
		}),
	});

	if (!resp.ok) {
		const body = await resp.text().catch(() => "");
		const err = new Error(
			`API 请求失败 (${resp.status}): ${body.slice(0, 200)}`,
		);
		err.code = `HTTP_${resp.status}`;
		throw err;
	}

	if (!resp.body) throw new Error("API 未提供可读取的响应流");
	const reader = resp.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let content = "";
	let finishReason = null;
	let done = false;
	function consume(event) {
		const data = event.split(/\r?\n/).filter((line) => line.startsWith("data:"))
			.map((line) => line.slice(5).trimStart()).join("\n");
		if (!data) return;
		if (data === "[DONE]") { done = true; return; }
		let chunk;
		try { chunk = JSON.parse(data); }
		catch { throw new Error("API 流事件格式错误"); }
		if (chunk.error) throw new Error(chunk.error.message || "API 流返回错误");
		const choice = chunk.choices?.[0];
		if (choice?.finish_reason) finishReason = choice.finish_reason;
		const delta = choice?.delta?.content;
		if (typeof delta === "string" && delta) {
			content += delta;
			onDelta(delta);
		}
	}
	try {
		while (!done) {
			const { value, done: ended } = await reader.read();
			buffer += decoder.decode(value || new Uint8Array(), { stream: !ended });
			let boundary;
			while ((boundary = /\r?\n\r?\n/.exec(buffer)) !== null) {
				consume(buffer.slice(0, boundary.index));
				buffer = buffer.slice(boundary.index + boundary[0].length);
				if (done) break;
			}
			if (ended) break;
		}
	} finally {
		if (done) await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
	if (!done) throw new Error("API 连接提前结束");
	if (!content.trim()) throw new Error("API 返回为空");
	return { content, finishReason };
}

/**
 * 拉取可用模型列表（OpenAI 兼容 /models 接口）。
 * 设置页用：把返回的模型 id 填进下拉框，不再硬编码。
 * @param {{ apiKey: string, baseUrl: string }} config
 * @returns {Promise<string[]>} 模型 id 数组（可能为空）
 */
export async function listModels(config) {
	const { apiKey, baseUrl } = config;
	if (!apiKey) {
		const err = new Error("未配置 API Key");
		err.code = "NO_API_KEY";
		throw err;
	}

	const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
		headers: { Authorization: `Bearer ${apiKey}` },
	});

	if (!resp.ok) {
		const body = await resp.text().catch(() => "");
		const err = new Error(
			`获取模型列表失败 (${resp.status}): ${body.slice(0, 120)}`,
		);
		err.code = `HTTP_${resp.status}`;
		throw err;
	}

	const data = await resp.json();
	return (data?.data || []).map((m) => m?.id).filter(Boolean);
}
