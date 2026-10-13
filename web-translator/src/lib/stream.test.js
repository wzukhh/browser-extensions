import test from "node:test";
import assert from "node:assert/strict";
import { translateStream } from "./api.js";
import { parseCardMarkdown } from "./markdown-card.js";

test("SSE can be split across bytes, lines and Unicode characters", async () => {
	const originalFetch = globalThis.fetch;
	const text = "类型: sentence\n## 翻译\n你好";
	const events = [
		`data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(0, 13) } }] })}\r\n\r\n`,
		`data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(13) }, finish_reason: "stop" }] })}\r\n\r\n`,
		"data: [DONE]\r\n\r\n",
	].join("");
	const bytes = new TextEncoder().encode(events);
	let index = 0;
	globalThis.fetch = async () => new Response(new ReadableStream({
		pull(controller) {
			if (index >= bytes.length) { controller.close(); return; }
			controller.enqueue(bytes.slice(index, index + 3));
			index += 3;
		},
	}), { status: 200 });
	try {
		const deltas = [];
		const result = await translateStream("prompt", "hello", {
			apiKey: "test", baseUrl: "https://example.com", model: "test", maxTokens: 100,
		}, { onDelta: (delta) => deltas.push(delta) });
		assert.equal(result.content, text);
		assert.equal(result.finishReason, "stop");
		assert.equal(deltas.join(""), text);
	} finally { globalThis.fetch = originalFetch; }
});

test("SSE content reaches the renderer callback before the response finishes", async () => {
	const originalFetch = globalThis.fetch;
	let streamController;
	let notifyFirstDelta;
	const firstDelta = new Promise((resolve) => { notifyFirstDelta = resolve; });
	globalThis.fetch = async () => new Response(new ReadableStream({
		start(controller) { streamController = controller; },
	}), { status: 200 });
	const encoder = new TextEncoder();
	let finished = false;
	const deltas = [];
	try {
		const request = translateStream("prompt", "hello", {
			apiKey: "test", baseUrl: "https://example.com", model: "test", maxTokens: 100,
		}, { onDelta(delta) { deltas.push(delta); notifyFirstDelta(); } })
			.finally(() => { finished = true; });
		streamController.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "类型: sentence\n## 翻译\n你好" } }] })}\n\n`));
		await firstDelta;
		assert.equal(finished, false);
		assert.deepEqual(deltas, ["类型: sentence\n## 翻译\n你好"]);
		streamController.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "，世界" }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`));
		streamController.close();
		const result = await request;
		assert.equal(result.content, "类型: sentence\n## 翻译\n你好，世界");
		assert.deepEqual(deltas, ["类型: sentence\n## 翻译\n你好", "，世界"]);
	} finally { globalThis.fetch = originalFetch; }
});

test("Markdown parser keeps useful sections and hides partial metadata", () => {
	const parsed = parseCardMarkdown("类型: sentence\n## 译文\n自然**翻译**\n## 词汇\n- **term** — 含义\n## 背", "word");
	assert.equal(parsed.type, "sentence");
	assert.deepEqual(parsed.sections.map((section) => section.title), ["翻译", "生词"]);
	assert.equal(parsed.sections[0].lines[0], "自然**翻译**");
	assert.deepEqual(parseCardMarkdown("类型: se", "phrase").sections, []);
});
