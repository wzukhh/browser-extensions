/**
 * DeepSeek API 调用（background 中使用）。
 * 设置项存 chrome.storage.local，模型与 baseUrl 可配置，方便换其他兼容 OpenAI 的供应商。
 */

const DEFAULT_CONFIG = {
	apiKey: "",
	baseUrl: "https://api.deepseek.com",
	model: "deepseek-chat",
	targetLang: "zh-CN",
	maxTokens: 800,
};

/** 读取设置（默认值兜底） */
export async function getConfig() {
	const stored = await chrome.storage.local.get(DEFAULT_CONFIG);
	return { ...DEFAULT_CONFIG, ...stored };
}

/**
 * 调用 DeepSeek 聊天补全，要求 JSON 输出。
 * @param {string} systemPrompt 按粒度构建的提示词
 * @param {string} text 用户文本
 * @returns {Promise<object>} 解析后的 JSON 对象
 */
export async function translate(systemPrompt, text, config) {
	const { apiKey, baseUrl, model, maxTokens } = config;
	if (!apiKey) {
		const err = new Error("未配置 API Key，请点击工具栏图标打开设置");
		err.code = "NO_API_KEY";
		throw err;
	}

	const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
		method: "POST",
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
			response_format: { type: "json_object" },
			stream: false,
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

	const data = await resp.json();
	const content = data?.choices?.[0]?.message?.content;
	if (!content) {
		const err = new Error("API 返回为空");
		err.code = "EMPTY_RESPONSE";
		throw err;
	}
	try {
		return JSON.parse(content);
	} catch {
		const err = new Error(`API 返回的不是有效 JSON：${content.slice(0, 80)}`);
		err.code = "BAD_JSON";
		throw err;
	}
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
