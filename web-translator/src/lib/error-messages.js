/** 把服务商或网络错误转成可操作的用户提示，不展示可能含敏感信息的原始响应。 */
export function friendlyError(error) {
	const code = error?.code || "";
	const status = error?.status || Number(/^HTTP_(\d+)$/.exec(code)?.[1]);
	if (code === "NO_API_KEY") return "还没有填写 API Key。请打开插件设置，填写后保存。";
	if (code === "NO_MODEL") return "还没有选择模型。请打开插件设置，刷新模型列表并保存。";
	if (status === 401 || status === 403) return `身份验证失败（HTTP ${status}）。请检查 API Key 和 API 地址。`;
	if (status === 402) return "服务商账户余额或额度不足（HTTP 402）。请检查账户额度后重试。";
	if (status === 404) return "接口或模型不存在（HTTP 404）。请检查 API 地址，并在设置中刷新模型列表。";
	if (status === 429) return "请求过于频繁或已达到额度限制（HTTP 429）。请稍后重试，并检查服务商限额。";
	if (status >= 500) return `模型服务暂时不可用（HTTP ${status}）。请稍后重试。`;
	if (status >= 400) return `请求被服务商拒绝（HTTP ${status}）。请检查模型、API 地址和服务商设置。`;
	if (["BAD_STREAM", "STREAM_INTERRUPTED", "EMPTY_RESPONSE"].includes(code)) return "模型响应中断或格式异常。请重试；若反复出现，可换一个模型或缩短原文。";
	if (error?.name === "TypeError" || code === "NETWORK") return "连接模型服务失败。请检查网络和 API 地址后重试。";
	return error?.message || "翻译失败，请重试。";
}
