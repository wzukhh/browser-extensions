// src/lib/api.js
async function listModels(config) {
  const { apiKey, baseUrl } = config;
  if (!apiKey) {
    const err = new Error("\u672A\u914D\u7F6E API Key");
    err.code = "NO_API_KEY";
    throw err;
  }
  const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (!resp.ok) {
    const err = new Error(`\u83B7\u53D6\u6A21\u578B\u5217\u8868\u5931\u8D25\uFF08HTTP ${resp.status}\uFF09`);
    err.code = `HTTP_${resp.status}`;
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();
  return (data?.data || []).map((m) => m?.id).filter(Boolean);
}

// src/lib/error-messages.js
function friendlyError(error) {
  const code = error?.code || "";
  const status = error?.status || Number(/^HTTP_(\d+)$/.exec(code)?.[1]);
  if (code === "NO_API_KEY") return "\u8FD8\u6CA1\u6709\u586B\u5199 API Key\u3002\u8BF7\u6253\u5F00\u63D2\u4EF6\u8BBE\u7F6E\uFF0C\u586B\u5199\u540E\u4FDD\u5B58\u3002";
  if (code === "NO_MODEL") return "\u8FD8\u6CA1\u6709\u9009\u62E9\u6A21\u578B\u3002\u8BF7\u6253\u5F00\u63D2\u4EF6\u8BBE\u7F6E\uFF0C\u5237\u65B0\u6A21\u578B\u5217\u8868\u5E76\u4FDD\u5B58\u3002";
  if (status === 401 || status === 403) return `\u8EAB\u4EFD\u9A8C\u8BC1\u5931\u8D25\uFF08HTTP ${status}\uFF09\u3002\u8BF7\u68C0\u67E5 API Key \u548C API \u5730\u5740\u3002`;
  if (status === 402) return "\u670D\u52A1\u5546\u8D26\u6237\u4F59\u989D\u6216\u989D\u5EA6\u4E0D\u8DB3\uFF08HTTP 402\uFF09\u3002\u8BF7\u68C0\u67E5\u8D26\u6237\u989D\u5EA6\u540E\u91CD\u8BD5\u3002";
  if (status === 404) return "\u63A5\u53E3\u6216\u6A21\u578B\u4E0D\u5B58\u5728\uFF08HTTP 404\uFF09\u3002\u8BF7\u68C0\u67E5 API \u5730\u5740\uFF0C\u5E76\u5728\u8BBE\u7F6E\u4E2D\u5237\u65B0\u6A21\u578B\u5217\u8868\u3002";
  if (status === 429) return "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\u6216\u5DF2\u8FBE\u5230\u989D\u5EA6\u9650\u5236\uFF08HTTP 429\uFF09\u3002\u8BF7\u7A0D\u540E\u91CD\u8BD5\uFF0C\u5E76\u68C0\u67E5\u670D\u52A1\u5546\u9650\u989D\u3002";
  if (status >= 500) return `\u6A21\u578B\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF08HTTP ${status}\uFF09\u3002\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002`;
  if (status >= 400) return `\u8BF7\u6C42\u88AB\u670D\u52A1\u5546\u62D2\u7EDD\uFF08HTTP ${status}\uFF09\u3002\u8BF7\u68C0\u67E5\u6A21\u578B\u3001API \u5730\u5740\u548C\u670D\u52A1\u5546\u8BBE\u7F6E\u3002`;
  if (["BAD_STREAM", "STREAM_INTERRUPTED", "EMPTY_RESPONSE"].includes(code)) return "\u6A21\u578B\u54CD\u5E94\u4E2D\u65AD\u6216\u683C\u5F0F\u5F02\u5E38\u3002\u8BF7\u91CD\u8BD5\uFF1B\u82E5\u53CD\u590D\u51FA\u73B0\uFF0C\u53EF\u6362\u4E00\u4E2A\u6A21\u578B\u6216\u7F29\u77ED\u539F\u6587\u3002";
  if (error?.name === "TypeError" || code === "NETWORK") return "\u8FDE\u63A5\u6A21\u578B\u670D\u52A1\u5931\u8D25\u3002\u8BF7\u68C0\u67E5\u7F51\u7EDC\u548C API \u5730\u5740\u540E\u91CD\u8BD5\u3002";
  return error?.message || "\u7FFB\u8BD1\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002";
}

// src/popup/popup.js
var DEFAULTS = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  targetLang: "zh-CN",
  showAuthor: true,
  showSelectionButton: true
};
var $ = (id) => document.getElementById(id);
var modelRequestId = 0;
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
function populateModels(models, preferredModel) {
  showModelPlaceholder("\u8BF7\u9009\u62E9\u6A21\u578B");
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
async function loadModels(preferredModel = $("model").value) {
  const requestId = ++modelRequestId;
  const cfg = {
    apiKey: $("apiKey").value.trim(),
    baseUrl: $("baseUrl").value.trim() || DEFAULTS.baseUrl
  };
  showModelPlaceholder("\u52A0\u8F7D\u4E2D\u2026");
  if (!cfg.apiKey) {
    showModelPlaceholder("\u586B\u5199 API Key \u540E\u5237\u65B0\u6A21\u578B");
    setStatus("\u8BF7\u5148\u586B\u5199 API Key\uFF0C\u518D\u70B9\u51FB\u6A21\u578B\u65C1\u7684\u5237\u65B0\u6309\u94AE", "err");
    return;
  }
  try {
    const models = await listModels(cfg);
    if (requestId !== modelRequestId) return;
    if (!models.length) throw new Error("\u63A5\u53E3\u8FD4\u56DE\u7A7A\u5217\u8868");
    populateModels(models, preferredModel);
    setStatus(`\u2705 \u5DF2\u52A0\u8F7D ${models.length} \u4E2A\u6A21\u578B`, "ok");
  } catch (err) {
    if (requestId !== modelRequestId) return;
    showModelPlaceholder("\u6A21\u578B\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0");
    setStatus(`\u274C \u52A0\u8F7D\u6A21\u578B\u5931\u8D25\uFF1A${friendlyError(err)}`, "err");
  }
}
async function load() {
  await chrome.storage.local.remove("terminology");
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
    showSelectionButton: $("showSelectionButton").checked
  };
  if (!cfg.model) {
    setStatus("\u8BF7\u5148\u52A0\u8F7D\u5E76\u9009\u62E9\u6A21\u578B", "err");
    return;
  }
  await chrome.storage.local.set(cfg);
  setStatus("\u2705 \u5DF2\u4FDD\u5B58", "ok");
});
$("refreshModels").addEventListener("click", () => loadModels());
$("testBtn").addEventListener("click", async () => {
  const cfg = {
    apiKey: $("apiKey").value.trim(),
    baseUrl: $("baseUrl").value.trim() || DEFAULTS.baseUrl,
    model: $("model").value,
    targetLang: $("targetLang").value,
    showAuthor: $("showAuthor").checked,
    showSelectionButton: $("showSelectionButton").checked
  };
  if (!cfg.apiKey) {
    setStatus("\u26A0\uFE0F \u8BF7\u5148\u586B\u5199 API Key", "err");
    return;
  }
  if (!cfg.model) {
    setStatus("\u8BF7\u5148\u52A0\u8F7D\u5E76\u9009\u62E9\u6A21\u578B", "err");
    return;
  }
  setStatus("\u23F3 \u6D4B\u8BD5\u4E2D\u2026", "");
  try {
    const resp = await fetch(
      `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5
        })
      }
    );
    if (!resp.ok) {
      setStatus(`\u274C ${friendlyError({ status: resp.status })}`, "err");
      return;
    }
    await chrome.storage.local.set(cfg);
    setStatus("\u2705 \u8FDE\u63A5\u6210\u529F\uFF0C\u5DF2\u4FDD\u5B58", "ok");
    await loadModels();
  } catch (err) {
    setStatus(`\u274C ${friendlyError(err)}`, "err");
  }
});
$("toggleEye").addEventListener("click", () => {
  const input = $("apiKey");
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  $("toggleEye").querySelector(".eye-open").style.display = isPassword ? "" : "none";
  $("toggleEye").querySelector(".eye-closed").style.display = isPassword ? "none" : "";
});
load();
