/**
 * 设置弹窗：配置 API Key / 模型 / 目标语言，测试连接。
 * 模型列表通过 DeepSeek /models API 动态拉取（不硬编码）。
 */

import { listModels } from "../lib/api.js";

const DEFAULTS = {
	apiKey: "",
	baseUrl: "https://api.deepseek.com",
	targetLang: "zh-CN",
	showAuthor: true,
	showSelectionButton: true,
};

const $ = (id) => document.getElementById(id);
let modelRequestId = 0;

function showModelPlaceholder(label) {
	const select = $("model");
	select.replaceChildren();
	const option = document.createElement("option");
	option.value = "";
	option.textContent = label;
	option.disabled = true;
	select.appendChild(option);
	select.value = "";
	select.disabled = true;
}

/** 仅恢复本次接口列表中仍存在的已保存/已选择模型 */
function populateModels(models, preferredModel) {
	showModelPlaceholder("请选择模型");
	const select = $("model");
	for (const id of models) {
		const opt = document.createElement("option");
		opt.value = id;
		opt.textContent = id;
		select.appendChild(opt);
	}
	select.disabled = false;
	select.value = preferredModel && models.includes(preferredModel) ? preferredModel : models[0];
}

/** 每次打开弹窗和手动刷新时都实时请求模型列表 */
async function loadModels(preferredModel = $("model").value) {
	const requestId = ++modelRequestId;
	const cfg = {
		apiKey: $("apiKey").value.trim(),
		baseUrl: $("baseUrl").value.trim() || DEFAULTS.baseUrl,
	};
	showModelPlaceholder("加载中…");

	if (!cfg.apiKey) {
		showModelPlaceholder("填写 API Key 后刷新模型");
		setStatus("请先填写 API Key，再点击模型旁的刷新按钮", "err");
		return;
	}
	try {
		const models = await listModels(cfg);
		if (requestId !== modelRequestId) return;
		if (!models.length) throw new Error("接口返回空列表");
		populateModels(models, preferredModel);
		setStatus(`✅ 已加载 ${models.length} 个模型`, "ok");
	} catch (err) {
		if (requestId !== modelRequestId) return;
		showModelPlaceholder("模型加载失败，请刷新");
		setStatus(`❌ 加载模型失败：${err.message}`, "err");
	}
}

async function load() {
	const cfg = await chrome.storage.local.get(DEFAULTS);
	$("apiKey").value = cfg.apiKey || "";
	$("baseUrl").value = cfg.baseUrl || DEFAULTS.baseUrl;
	$("targetLang").value = cfg.targetLang || DEFAULTS.targetLang;
	$("showAuthor").checked = cfg.showAuthor !== false;
	$("showSelectionButton").checked = cfg.showSelectionButton !== false;
	await loadModels(cfg.model || "");
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
		showSelectionButton: $("showSelectionButton").checked,
	};
	if (!cfg.model) {
		setStatus("请先加载并选择模型", "err");
		return;
	}
	await chrome.storage.local.set(cfg);
	setStatus("✅ 已保存", "ok");
});

$("refreshModels").addEventListener("click", () => loadModels());

$("testBtn").addEventListener("click", async () => {
	const cfg = {
		apiKey: $("apiKey").value.trim(),
		baseUrl: $("baseUrl").value.trim() || DEFAULTS.baseUrl,
		model: $("model").value,
		targetLang: $("targetLang").value,
		showAuthor: $("showAuthor").checked,
		showSelectionButton: $("showSelectionButton").checked,
	};
	if (!cfg.apiKey) {
		setStatus("⚠️ 请先填写 API Key", "err");
		return;
	}
	if (!cfg.model) {
		setStatus("请先加载并选择模型", "err");
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
