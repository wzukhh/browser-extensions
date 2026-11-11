import test from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt } from "./prompt-builder.js";
import { friendlyError } from "./error-messages.js";

test("目标语言影响正文指令，但保留卡片栏目协议", () => {
	const chinese = buildSystemPrompt({ targetLang: "zh-CN" });
	const english = buildSystemPrompt({ targetLang: "en" });
	assert.match(chinese, /目标语言是简体中文/);
	assert.match(english, /目标语言是英语/);
	assert.match(english, /## 翻译/);
	assert.match(english, /栏目标题始终保持下面的中文写法/);
});

test("常见服务错误提供对应处理建议", () => {
	assert.match(friendlyError({ status: 401 }), /API Key/);
	assert.match(friendlyError({ status: 429 }), /稍后重试/);
	assert.match(friendlyError({ code: "STREAM_INTERRUPTED" }), /缩短原文/);
	assert.match(friendlyError(new TypeError("Failed to fetch")), /检查网络/);
});
