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
    const body = await resp.text().catch(() => "");
    const err = new Error(
      `\u83B7\u53D6\u6A21\u578B\u5217\u8868\u5931\u8D25 (${resp.status}): ${body.slice(0, 120)}`
    );
    err.code = `HTTP_${resp.status}`;
    throw err;
  }
  const data = await resp.json();
  return (data?.data || []).map((m) => m?.id).filter(Boolean);
}

// src/popup/popup.js
var DEFAULTS = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
  targetLang: "zh-CN",
  showAuthor: true
};
var FALLBACK_MODELS = ["deepseek-chat", "deepseek-reasoner"];
var $ = (id) => document.getElementById(id);
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
async function loadModels() {
  const cfg = {
    apiKey: $("apiKey").value.trim(),
    baseUrl: $("baseUrl").value.trim() || DEFAULTS.baseUrl
  };
  const prev = $("model").value;
  if (!cfg.apiKey) {
    populateModels(FALLBACK_MODELS, prev);
    return;
  }
  try {
    const models = await listModels(cfg);
    if (!models.length) throw new Error("\u63A5\u53E3\u8FD4\u56DE\u7A7A\u5217\u8868");
    populateModels(models, prev);
    setStatus(`\u2705 \u5DF2\u52A0\u8F7D ${models.length} \u4E2A\u6A21\u578B`, "ok");
  } catch (err) {
    populateModels(FALLBACK_MODELS, prev);
    setStatus(`\u274C \u52A0\u8F7D\u6A21\u578B\u5931\u8D25\uFF1A${err.message}`, "err");
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
    showAuthor: $("showAuthor").checked
  };
  await chrome.storage.local.set(cfg);
  setStatus("\u2705 \u5DF2\u4FDD\u5B58", "ok");
});
$("refreshModels").addEventListener("click", loadModels);
$("testBtn").addEventListener("click", async () => {
  const cfg = {
    apiKey: $("apiKey").value.trim(),
    baseUrl: $("baseUrl").value.trim() || DEFAULTS.baseUrl,
    model: $("model").value,
    targetLang: $("targetLang").value,
    showAuthor: $("showAuthor").checked
  };
  if (!cfg.apiKey) {
    setStatus("\u26A0\uFE0F \u8BF7\u5148\u586B\u5199 API Key", "err");
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
      const body = await resp.text().catch(() => "");
      setStatus(`\u274C HTTP ${resp.status}: ${body.slice(0, 80)}`, "err");
      return;
    }
    await chrome.storage.local.set(cfg);
    setStatus("\u2705 \u8FDE\u63A5\u6210\u529F\uFF0C\u5DF2\u4FDD\u5B58", "ok");
    await loadModels();
  } catch (err) {
    setStatus(`\u274C ${err.message}`, "err");
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
