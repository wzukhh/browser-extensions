(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const showView = (id) => {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    $(id).classList.remove('hidden');
  };

  // ── Auth (session token from extension-opened URL) ────────────
  var token = new URLSearchParams(location.search).get('token');
  var authHeaders = token ? { 'Authorization': 'Bearer ' + token } : {};
  var jsonHeaders = Object.assign({ 'Content-Type': 'application/json' }, authHeaders);

  if (!token) {
    document.body.innerHTML =
      '<div style="text-align:center;padding:50px;font-family:sans-serif">' +
      '<p style="font-size:2rem">⚠️</p><p>访问链接不完整</p>' +
      '<p style="font-size:0.85rem;color:#999;margin-top:8px">请点击浏览器工具栏的 Word2PDF 扩展图标打开</p></div>';
    return;
  }

  // ── State ─────────────────────────────────────────────────────
  var convertAbort = null;
  var timer = null;

  var state = {
    app: null,
    sourceFolder: '',
    outputFolder: '',
    files: [],
    results: [],
    successCount: 0,
    failCount: 0,
  };

  // ── API helpers ───────────────────────────────────────────────
  function showServiceStopped(reason) {
    if (reason) {
      $('service-stopped-msg').textContent = reason;
    }
    showView('view-service-stopped');
    setBadge('err', '已退出');
  }

  async function apiFetch(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, authHeaders, opts.headers || {});
    var res;
    try {
      res = await fetch(url, opts);
    } catch (err) {
      showServiceStopped('无法连接本地转换服务，可能因长时间无操作已自动关闭。');
      throw err;
    }
    if (res.status === 401) {
      showServiceStopped('会话已失效，请重新点击扩展图标启动。');
      throw new Error('unauthorized');
    }
    return res;
  }

  async function readErrorMessage(res) {
    var text = '';
    try {
      text = await res.text();
    } catch (err) {
      return '请求失败';
    }
    if (!text) return '请求失败';
    try {
      var data = JSON.parse(text);
      return data.error || data.message || text;
    } catch (err) {
      return text;
    }
  }

  function joinPath(base, name) {
    var clean = String(base || '').replace(/[\\\/]+$/, '');
    if (!clean) return name;
    var sep = clean.indexOf('\\') >= 0 ? '\\' : '/';
    return clean + sep + name;
  }

  function defaultOutputFolder(source) {
    return joinPath(source, 'word2pdf_output');
  }

  // ── Bootstrap ─────────────────────────────────────────────────
  (async function init() {
    showView('view-detection');
    try {
      var res = await apiFetch('/api/status');
      var info = await res.json();

      if (!info.available) {
        showView('view-no-office');
        setBadge('err', '未检测到');
        return;
      }

      state.app = info.app;
      setBadge('ready', '使用 ' + info.app);
      $('engine-info').textContent = '转换引擎: ' + info.app + (info.path ? ' · ' + info.path : '');
      showView('view-setup');
    } catch (err) {
      // apiFetch already shows the stopped view on network/401 errors.
    }
  })();

  // ── Badge ─────────────────────────────────────────────────────
  function setBadge(type, text) {
    var el = $('status-badge');
    el.className = 'badge badge-' + type;
    el.textContent = text;
  }

  // ── Folder browsing ───────────────────────────────────────────
  async function browseFolder() {
    var res = await apiFetch('/api/browse-folder', { method: 'POST' });
    var data = await res.json();
    return data.success ? data.path : null;
  }

  $('browse-source').addEventListener('click', async function () {
    try {
      var path = await browseFolder();
      if (path) {
        $('source-folder').value = path;
        state.sourceFolder = path;
        $('source-hint').textContent = '';
        await loadFileList(path);
      }
    } catch (err) { /* handled in apiFetch */ }
  });

  $('browse-output').addEventListener('click', async function () {
    try {
      var path = await browseFolder();
      if (path) {
        $('output-folder').value = path;
        state.outputFolder = path;
      }
      updateConvertButton();
    } catch (err) { /* handled in apiFetch */ }
  });

  // ── File list loading ─────────────────────────────────────────
  async function loadFileList(folder) {
    var body = $('file-list-body');
    var countEl = $('file-count');

    try {
      var res = await apiFetch('/api/list-docs', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ folder: folder }),
      });
      var data = await res.json();

      if (!data.success || !data.files || data.files.length === 0) {
        body.innerHTML = '<div class="file-list-empty">未找到 .doc / .docx 文件</div>';
        countEl.textContent = '0 个';
        state.files = [];
        updateConvertButton();
        return;
      }

      state.files = data.files.map(function (f) { return Object.assign({}, f, { selected: true }); });
      renderFileList();
      countEl.textContent = state.files.length + ' 个';
      updateConvertButton();
    } catch (err) {
      if ($('view-service-stopped').classList.contains('hidden')) {
        body.innerHTML = '<div class="file-list-empty">加载文件列表失败</div>';
        state.files = [];
        updateConvertButton();
      }
    }
  }

  function renderFileList() {
    var body = $('file-list-body');
    if (state.files.length === 0) {
      body.innerHTML = '<div class="file-list-empty">没有要转换的文件</div>';
      return;
    }

    body.innerHTML = state.files.map(function (f, i) {
      return '<div class="file-item">' +
        '<input type="checkbox" data-index="' + i + '"' + (f.selected ? ' checked' : '') + '>' +
        '<span class="file-name">' + esc(f.name) + '</span>' +
        '<span class="file-size">' + formatSize(f.size) + '</span>' +
        '</div>';
    }).join('');

    [].slice.call(body.querySelectorAll('input[type="checkbox"]')).forEach(function (cb) {
      cb.addEventListener('change', function () {
        var idx = parseInt(cb.dataset.index, 10);
        state.files[idx].selected = cb.checked;
        syncSelectAll();
        updateConvertButton();
      });
    });

    syncSelectAll();
  }

  function syncSelectAll() {
    var all = $('select-all');
    if (!all) return;
    var sel = state.files.filter(function (f) { return f.selected; }).length;
    all.checked = sel === state.files.length;
    all.indeterminate = sel > 0 && sel < state.files.length;
  }

  $('select-all-wrap') && $('select-all-wrap').addEventListener('change', function (e) {
    var checked = e.target.querySelector('input').checked;
    state.files.forEach(function (f) { f.selected = checked; });
    renderFileList();
    updateConvertButton();
  });

  // ── Convert button state ──────────────────────────────────────
  function updateConvertButton() {
    var btn = $('btn-convert');
    var selected = state.files.filter(function (f) { return f.selected; }).length;
    btn.disabled = !(state.sourceFolder && selected > 0);
  }

  // ── Format helpers ────────────────────────────────────────────
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ── SSE stream reader (POST + streaming response) ─────────────
  function readSSEStream(body, onProgress) {
    var reader = body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';

    function parseBlock(block) {
      if (!block.trim()) return;
      var lines = block.split('\n');
      var eventType = 'message';
      var data = '';
      lines.forEach(function (line) {
        if (line.indexOf('event: ') === 0) eventType = line.slice(7).trim();
        else if (line.indexOf('data: ') === 0) data = line.slice(6);
      });
      if (eventType === 'progress' && data) {
        onProgress(JSON.parse(data));
      }
    }

    return (async function pump() {
      while (true) {
        var result = await reader.read();
        if (result.done) break;
        buffer += decoder.decode(result.value, { stream: true });
        var parts = buffer.split('\n\n');
        buffer = parts.pop();
        parts.forEach(parseBlock);
      }
      if (buffer.trim()) parseBlock(buffer);
    })();
  }

  // ── Conversion ────────────────────────────────────────────────
  $('btn-convert').addEventListener('click', startConversion);
  $('btn-abort').addEventListener('click', abortConversion);
  $('btn-view-results').addEventListener('click', showResults);

  function resetResults() {
    state.results = [];
    state.successCount = 0;
    state.failCount = 0;
  }

  async function startConversion() {
    var selected = state.files.filter(function (f) { return f.selected; });
    if (selected.length === 0) return;

    resetResults();
    showView('view-converting');
    setBadge('busy', '转换中');

    $('log-body').innerHTML = '';
    $('progress-fill').style.width = '0%';
    $('progress-text').textContent = '0 / ' + selected.length;
    $('prog-ok').textContent = '0';
    $('prog-fail').textContent = '0';
    $('progress-file').textContent = '准备中…';
    $('progress-time').textContent = '00:00';
    $('btn-abort').classList.remove('hidden');
    $('btn-view-results').classList.add('hidden');

    var startTime = Date.now();
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      var sec = Math.floor((Date.now() - startTime) / 1000);
      var m = String(Math.floor(sec / 60)).padStart(2, '0');
      var s = String(sec % 60).padStart(2, '0');
      $('progress-time').textContent = m + ':' + s;
    }, 200);

    var source = state.sourceFolder;
    var output = state.outputFolder || defaultOutputFolder(source);

    convertAbort = new AbortController();
    var aborted = false;
    var failed = false;
    try {
      var res = await apiFetch('/api/convert', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          source: source,
          output: output,
          files: selected.map(function (f) { return f.name; }),
        }),
        signal: convertAbort.signal,
      });

      var contentType = res.headers.get('Content-Type') || '';
      if (!res.ok || contentType.indexOf('text/event-stream') === -1) {
        throw new Error(await readErrorMessage(res));
      }

      await readSSEStream(res.body, function (data) {
        handleProgress(data, selected.length);
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        aborted = true;
        addLog('⏹', '用户中止', 'err');
      } else {
        failed = true;
        var msg = err.message || '转换请求失败';
        $('progress-file').textContent = '❌ ' + msg;
        addLog('❌', msg, 'err');
      }
    } finally {
      convertAbort = null;
      if (timer) { clearInterval(timer); timer = null; }
      if (aborted) setBadge('err', '已中止');
      else if (failed) setBadge('err', '转换失败');
      else setBadge('done', '已完成');
      $('btn-abort').classList.add('hidden');
      $('btn-view-results').classList.remove('hidden');
    }
  }

  function handleProgress(data, total) {
    $('progress-fill').style.width = Math.min(Math.round((data.current / total) * 100), 100) + '%';
    $('progress-text').textContent = data.current + ' / ' + total;

    if (data.status === 'converting') {
      $('progress-file').textContent = '⏳ ' + data.fileName;
    } else if (data.status === 'success') {
      $('progress-file').textContent = '✅ ' + data.fileName;
      state.successCount++;
      state.results.push({
        name: data.fileName,
        status: 'success',
        inputSize: data.inputSize,
        outputSize: data.outputSize,
        output: data.output,
      });
      $('prog-ok').textContent = state.successCount;
      var meta = '';
      if (data.inputSize) meta = formatSize(data.inputSize) + ' → ' + formatSize(data.outputSize);
      if (data.duration) meta += (meta ? ' · ' : '') + data.duration;
      addLog('✅', data.fileName, 'success', meta);
    } else if (data.status === 'failed') {
      $('progress-file').textContent = '❌ ' + data.fileName;
      state.failCount++;
      state.results.push({
        name: data.fileName,
        status: 'failed',
        error: data.error || '未知错误',
      });
      $('prog-fail').textContent = state.failCount;
      var err = data.fileName + ' — ' + (data.error || '');
      addLog('❌', err, 'err', data.duration || '');
    } else if (data.status === 'aborted') {
      $('progress-file').textContent = '⏹ 已中止';
    } else if (data.status === 'complete') {
      $('progress-file').textContent = '✅ ' + (data.fileName || '完成');
    }

    var logBody = $('log-body');
    logBody.scrollTop = logBody.scrollHeight;
  }

  function addLog(icon, msg, cls, suffix) {
    var div = document.createElement('div');
    div.className = 'log-entry';
    var html = '<span class="icon">' + icon + '</span><span class="msg ' + cls + '">' + esc(msg) + '</span>';
    if (suffix) html += '<span class="meta">' + esc(suffix) + '</span>';
    div.innerHTML = html;
    $('log-body').appendChild(div);
  }

  function abortConversion() {
    if (convertAbort) convertAbort.abort();
    apiFetch('/api/stop', { method: 'POST' }).catch(function () {});
    if (timer) { clearInterval(timer); timer = null; }
    $('btn-abort').classList.add('hidden');
    $('btn-view-results').classList.remove('hidden');
  }

  // ── Results view ──────────────────────────────────────────────
  function showResults() {
    showView('view-complete');

    var total = state.successCount + state.failCount;
    $('result-text').textContent = '已处理 ' + total + ' 个文件 · 成功 ' + state.successCount + ' · 失败 ' + state.failCount;

    if (state.outputFolder) {
      $('output-path-label').textContent = '📂 ' + state.outputFolder;
      $('output-path-label').classList.remove('hidden');
    } else {
      var defaultOutput = defaultOutputFolder(state.sourceFolder);
      $('output-path-label').textContent = '📂 ' + defaultOutput;
      $('output-path-label').classList.remove('hidden');
    }

    $('success-count').textContent = state.successCount;
    var sList = $('success-list');
    var sItems = state.results.filter(function (r) { return r.status === 'success'; });
    if (sItems.length === 0) {
      sList.innerHTML = '<div class="file-list-empty">无</div>';
    } else {
      sList.innerHTML = sItems.map(function (r) {
        var meta = r.inputSize ? formatSize(r.inputSize) + ' → ' + formatSize(r.outputSize) : '';
        return '<div class="result-item">' +
          '<span class="name">' + esc(r.name) + '</span>' +
          (meta ? '<span class="meta">' + esc(meta) + '</span>' : '') +
          '</div>';
      }).join('');
    }

    $('fail-count').textContent = state.failCount;
    var fList = $('fail-list');
    var fItems = state.results.filter(function (r) { return r.status === 'failed'; });
    if (fItems.length === 0) {
      fList.innerHTML = '<div class="file-list-empty">无</div>';
    } else {
      fList.innerHTML = fItems.map(function (r) {
        return '<div class="result-item">' +
          '<span class="name">' + esc(r.name) + '</span>' +
          '<span class="error-msg">' + esc(r.error) + '</span>' +
          '</div>';
      }).join('');
    }
  }

  // ── Back / Open output ────────────────────────────────────────
  $('btn-back').addEventListener('click', function () {
    if (convertAbort) convertAbort.abort();
    if (timer) { clearInterval(timer); timer = null; }
    apiFetch('/api/stop', { method: 'POST' }).catch(function () {});
    state.sourceFolder = '';
    state.outputFolder = '';
    state.files = [];
    state.results = [];
    state.successCount = 0;
    state.failCount = 0;
    $('source-folder').value = '';
    $('output-folder').value = '';
    $('file-list-body').innerHTML = '<div class="file-list-empty">请先选择源文件夹</div>';
    $('file-count').textContent = '0 个';
    $('source-hint').textContent = '仅支持选择文件夹，文件夹内所有 .doc/.docx 文件将自动识别';
    $('btn-convert').disabled = true;
    showView('view-setup');
    setBadge('ready', '使用 ' + (state.app || ''));
  });

  $('btn-open-output').addEventListener('click', function () {
    var path = state.outputFolder || defaultOutputFolder(state.sourceFolder);
    apiFetch('/api/open-folder', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ path: path }),
    }).catch(function () {});
  });

})();
