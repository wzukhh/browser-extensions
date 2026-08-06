/**
 * 设置弹窗：配置 API Key / 模型 / 目标语言，测试连接。
 * 模型列表通过 DeepSeek /models API 动态拉取（不硬编码）。
 */

import { listModels } from "../lib/api.js";

const DEFAULTS = {
	apiKey: "",
	baseUrl: "https://api.deepseek.com",
	model: "deepseek-chat",
	targetLang: "zh-CN",
	showAuthor: true,
};

/** 拉取失败 / 未配置 Key 时的兜底列表 */
const FALLBACK_MODELS = ["deepseek-chat", "deepseek-reasoner"];

const $ = (id) => document.getElementById(id);

/** 把模型数组填进下拉框，尽量保持当前选中项 */
function populateModels(models, prevValue) {
	const select = $("model");
	select.replaceChildren();
	for (const id of models) {
		const opt = document.createElement("option");
		opt.value = id;
		opt.textContent = id;
		select.appendChild(opt);
	}
	if (prevValue && models.includes(prevValue)) {
		select.value = prevValue;
	} else if (models.includes(DEFAULTS.model)) {
		select.value = DEFAULTS.model;
	} else {
		select.value = models[0] || "";
	}
}

/** 从表单读配置并拉取模型列表；失败则回落默认选项 */
async function loadModels() {
	const cfg = {
		apiKey: $("apiKey").value.trim(),
		baseUrl: $("baseUrl").value.trim() || DEFAULTS.baseUrl,
	};
	const prev = $("model").value;

	if (!cfg.apiKey) {
		populateModels(FALLBACK_MODELS, prev);
		return;
	}
	try {
		const models = await listModels(cfg);
		if (!models.length) throw new Error("接口返回空列表");
		populateModels(models, prev);
		setStatus(`✅ 已加载 ${models.length} 个模型`, "ok");
	} catch (err) {
		populateModels(FALLBACK_MODELS, prev);
		setStatus(`❌ 加载模型失败：${err.message}`, "err");
	}
}

async function load() {
	const cfg = await chrome.storage.local.get(DEFAULTS);
	$("apiKey").value = cfg.apiKey || "";
	$("baseUrl").value = cfg.baseUrl || DEFAULTS.baseUrl;
	$("targetLang").value = cfg.targetLang || DEFAULTS.targetLang;
	$("model").value = cfg.model || DEFAULTS.model;
	$("showAuthor").checked = cfg.showAuthor !== false;
	await loadModels();
}

function setStatus(text, cls) {
	const el = $("status");
	el.textContent = text;
	el.className = cls || "";
}

$("saveBtn").addEventListener("click", async () => {
	const cfg = {
		apiKey: $("apiKey").value.trim(),
		baseUrl: $("baseUrl").value.trim() || DEFAULTS.baseUrl,
		model: $("model").value,
		targetLang: $("targetLang").value,
		showAuthor: $("showAuthor").checked,
	};
	await chrome.storage.local.set(cfg);
	setStatus("✅ 已保存", "ok");
});

$("refreshModels").addEventListener("click", loadModels);

$("testBtn").addEventListener("click", async () => {
	const cfg = {
		apiKey: $("apiKey").value.trim(),
		baseUrl: $("baseUrl").value.trim() || DEFAULTS.baseUrl,
		model: $("model").value,
		targetLang: $("targetLang").value,
		showAuthor: $("showAuthor").checked,
	};
	if (!cfg.apiKey) {
		setStatus("⚠️ 请先填写 API Key", "err");
		return;
	}
	setStatus("⏳ 测试中…", "");
	try {
		const resp = await fetch(
			`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${cfg.apiKey}`,
				},
				body: JSON.stringify({
					model: cfg.model,
					messages: [{ role: "user", content: "ping" }],
					max_tokens: 5,
				}),
			},
		);
		if (!resp.ok) {
			const body = await resp.text().catch(() => "");
			setStatus(`❌ HTTP ${resp.status}: ${body.slice(0, 80)}`, "err");
			return;
		}
		await chrome.storage.local.set(cfg);
		setStatus("✅ 连接成功，已保存", "ok");
		await loadModels(); // 连接成功顺便刷新模型列表
	} catch (err) {
		setStatus(`❌ ${err.message}`, "err");
	}
});

$("toggleEye").addEventListener("click", () => {
	const input = $("apiKey");
	const isPassword = input.type === "password";
	input.type = isPassword ? "text" : "password";
	// 密码隐藏时显示睁眼（点击可查看），可见时显示闭眼（点击可隐藏）
	$("toggleEye").querySelector(".eye-open").style.display = isPassword
		? ""
		: "none";
	$("toggleEye").querySelector(".eye-closed").style.display = isPassword
		? "none"
		: "";
});

load();
