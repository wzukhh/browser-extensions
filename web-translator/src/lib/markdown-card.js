/** 将模型的 Markdown 栏目归一化。容忍标题变体和未闭合的最后一行。 */
const TITLES = new Map([
	["音标", "音标"], ["释义", "释义"], ["词义", "释义"],
	["翻译", "翻译"], ["译文", "翻译"], ["含义", "翻译"],
	["解释", "解释"], ["例句", "例句"], ["词根词缀", "词根词缀"],
	["记忆点", "记忆点"], ["使用场景", "使用场景"], ["用法", "使用场景"],
	["语气", "语气"], ["语法批注", "语法批注"], ["语法", "语法批注"],
	["生词", "生词"], ["词汇", "生词"], ["短语搭配", "短语搭配"],
	["短语", "短语搭配"], ["背景知识", "背景知识"], ["背景", "背景知识"],
]);

export function parseCardMarkdown(markdown, fallbackType = "sentence") {
	const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
	const sections = [];
	let type = fallbackType;
	let current = null;
	for (const line of lines) {
		const typeMatch = line.trim().match(/^(?:类型|type)\s*[:：]\s*(word|phrase|sentence)\s*$/i);
		if (typeMatch) { type = typeMatch[1].toLowerCase(); continue; }
		if (/^(?:类型|type)\s*[:：]/i.test(line.trim())) continue;
		const heading = line.trim().match(/^#{1,3}\s*(.+?)\s*#*\s*$/);
		if (heading) {
			const title = heading[1].replace(/[：:]$/, "").trim();
			current = { title: TITLES.get(title) || title, lines: [] };
			sections.push(current);
			continue;
		}
		if (/^\s*#/.test(line) || /^\s*```/.test(line)) continue;
		if (!current) {
			if (!line.trim()) continue;
			current = { title: type === "word" ? "释义" : "翻译", lines: [] };
			sections.push(current);
		}
		current.lines.push(line);
	}
	return {
		type: ["word", "phrase", "sentence"].includes(type) ? type : "sentence",
		sections: sections.map(({ title, lines }) => ({ title, lines: trimBlank(lines) }))
			.filter(({ lines }) => lines.some((line) => line.trim())),
	};
}

function trimBlank(lines) {
	let start = 0;
	let end = lines.length;
	while (start < end && !lines[start].trim()) start++;
	while (end > start && !lines[end - 1].trim()) end--;
	return lines.slice(start, end);
}
