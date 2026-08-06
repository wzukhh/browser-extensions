// ─── Device Detection ───────────────────────────────────────
var host = window.location.hostname;
var isPC = host === 'localhost' || host === '127.0.0.1';

// ─── State ───────────────────────────────────────────────────
var token = new URLSearchParams(location.search).get('token');
var serverInfo = null;
var activeTab = 'sent';
var pendingReceived = 0;

var deviceId = null;
var deviceName = null;
var deviceSecret = null;
var allDevices = [];         // PC only: list of connected mobile devices
var selectedTargets = [];     // PC only: target device IDs for upload
var filterDeviceId = '';     // PC only: '' means "all devices"

if (!token) {
  document.body.innerHTML =
    '<div style="text-align:center;padding:50px;font-family:sans-serif">' +
    '<p style="font-size:2rem">⚠️</p><p>访问链接不完整</p>' +
    '<p style="font-size:0.85rem;color:#999;margin-top:8px">请通过浏览器扩展打开此页面</p></div>';
  throw new Error('Missing token');
}

// ─── Auth ─────────────────────────────────────────────────────
function withQuery(path, params) {
  var parts = [];
  for (var key in params) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
    }
  }
  if (parts.length === 0) return path;
  return path + (path.indexOf('?') === -1 ? '?' : '&') + parts.join('&');
}

var api = function(path) { return withQuery(path, { token: token }); };
var deviceApi = function(path) {
  return withQuery(path, {
    token: token,
    deviceId: deviceId,
    deviceSecret: deviceSecret
  });
};
var authHeaders = { 'Authorization': 'Bearer ' + token };
var jsonHeaders = Object.assign({}, authHeaders, { 'Content-Type': 'application/json' });

function showServiceStopped(reason) {
  if (reason) {
    var msgEl = document.getElementById('service-stopped-msg');
    if (msgEl) msgEl.textContent = reason;
  }
  var container = document.querySelector('.container');
  if (container) container.hidden = true;
  var view = document.getElementById('view-service-stopped');
  if (view) view.hidden = false;
}

function apiFetch(url, opts) {
  opts = opts || {};
  var includeDevice = opts.deviceAuth === true;
  delete opts.deviceAuth;
  opts.headers = Object.assign({}, authHeaders, opts.headers || {});
  url = includeDevice ? deviceApi(url) : api(url);
  return fetch(url, opts).then(function(res) {
    if (res.status === 401) {
      showServiceStopped('会话已失效，请重新点击扩展图标启动。');
      throw new Error('unauthorized');
    }
    return res;
  }).catch(function(err) {
    if (err && err.message === 'unauthorized') throw err;
    showServiceStopped('无法连接本地传输服务，可能因长时间无操作已自动关闭。');
    throw err;
  });
}

// ─── Helpers ─────────────────────────────────────────────────
function escHtml(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fmtSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  var units = ['B', 'KB', 'MB', 'GB'];
  var i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}
function fmtTime(t) {
  var d = new Date(t);
  var pad = function(n) { return String(n).padStart(2, '0'); };
  return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// ─── Toast Notification ──────────────────────────────────────
function showToast(msg) {
  var existing = document.getElementById('toast');
  if (existing) existing.remove();
  var toast = document.createElement('div');
  toast.id = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(function() { toast.style.opacity = '1'; });
  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() { toast.remove(); }, 400);
  }, 2500);
}

// ─── UI Setup ────────────────────────────────────────────────
function applyMode() {
  document.getElementById('deviceIcon').textContent = isPC ? '🖥️' : '📱';
  document.getElementById('deviceTitle').textContent = isPC ? '电脑端' : '手机端';
  document.getElementById('deviceSubtitle').textContent = isPC ? '扫码分享文件' : '已连接到电脑';
  document.getElementById('uploadBtn').textContent = isPC ? '📤 选择要发送的文件' : '📤 选择要上传的文件';
  document.getElementById('uploadHint').textContent = isPC ? '选择目标设备后发送' : '上传到电脑';
  document.getElementById('sentTab').textContent = '📤 已发送';
  document.getElementById('receivedTab').textContent = '📥 已接收';
  document.getElementById('qrCard').style.display = isPC ? 'block' : 'none';
  document.getElementById('savePathCard').style.display = isPC ? 'block' : 'none';
  document.getElementById('devicePanel').hidden = !isPC;
  document.getElementById('targetBar').hidden = !isPC;
  document.getElementById('filterBar').hidden = !isPC;
  document.getElementById('deviceNameRow').hidden = isPC;
  document.title = isPC ? '🖥️ LAN 文件传输' : '📱 LAN 文件传输';

  // PC always uses light theme regardless of system preference
  if (isPC) {
    document.body.classList.add('light-mode');
  }
}

if (isPC) { document.body.classList.add('pc-layout'); }

applyMode();

// ─── Device Registration ─────────────────────────────────────
function initDevice() {
  var storedId = localStorage.getItem('lft_deviceId');

  if (storedId) {
    deviceId = storedId;
    deviceSecret = localStorage.getItem('lft_deviceSecret') || '';
    deviceName = localStorage.getItem('lft_deviceName') || (isPC ? '电脑' : '手机');
    updateDeviceNameUI();
    return apiFetch('/api/device/register', {
      method: 'POST', headers: jsonHeaders,
      body: JSON.stringify({ deviceId: deviceId, deviceSecret: deviceSecret, name: deviceName, isPC: isPC })
    }).then(function(r) {
      if (!r.ok) throw new Error('register failed');
      return r.json();
    }).then(function(data) {
      if (data && data.deviceSecret) {
        deviceSecret = data.deviceSecret;
        localStorage.setItem('lft_deviceSecret', deviceSecret);
      }
      if (isPC) { loadDevices(); }
      afterRegister();
    });
  }

  // First time — register, then start loading
  var initName = isPC ? '电脑' : ('手机-' + Math.random().toString(36).substr(2, 4).toUpperCase());
  return apiFetch('/api/device/register', {
    method: 'POST', headers: jsonHeaders,
    body: JSON.stringify({ name: initName, isPC: isPC })
  }).then(function(r) { return r.json(); }).then(function(data) {
    deviceId = data.deviceId;
    deviceSecret = data.deviceSecret;
    deviceName = data.name;
    localStorage.setItem('lft_deviceId', deviceId);
    localStorage.setItem('lft_deviceSecret', deviceSecret);
    localStorage.setItem('lft_deviceName', deviceName);
    updateDeviceNameUI();

    // Start loading data even before the modal is dismissed
    if (isPC) { loadDevices(); }
    afterRegister();

    if (!isPC) {
      document.getElementById('nameInput').value = deviceName;
      document.getElementById('nameModal').hidden = false;
    }
  });
}

// ─── Device Rename ──────────────────────────────────────────
document.getElementById('nameConfirm').addEventListener('click', function() {
  submitDeviceName();
});
document.getElementById('nameInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') submitDeviceName();
});
// Close modal on background click — don't re-call afterRegister
document.getElementById('nameModal').addEventListener('click', function(e) {
  if (e.target === this) {
    document.getElementById('nameModal').hidden = true;
  }
});

function submitDeviceName() {
  var newName = document.getElementById('nameInput').value.trim();
  if (!newName) { showToast('⚠️ 请输入设备名称'); return; }
  if (newName === deviceName) {
    document.getElementById('nameModal').hidden = true;
    return;
  }
  apiFetch('/api/device/register', {
    method: 'POST', headers: jsonHeaders,
    body: JSON.stringify({ deviceId: deviceId, deviceSecret: deviceSecret, name: newName, isPC: false })
  }).then(function(r) {
    if (!r.ok) return r.json().then(function(err) { throw err; });
    return r.json();
  }).then(function(data) {
    deviceName = data.name;
    if (data.deviceSecret) {
      deviceSecret = data.deviceSecret;
      localStorage.setItem('lft_deviceSecret', deviceSecret);
    }
    localStorage.setItem('lft_deviceName', deviceName);
    updateDeviceNameUI();
    document.getElementById('nameModal').hidden = true;
  }).catch(function(err) {
    if (err && err.error === 'name already exists') {
      showToast('❌ 该名称已被其他设备使用');
    } else {
      showToast('❌ 改名失败');
    }
  });
}

function updateDeviceNameUI() {
  if (!isPC && deviceName) {
    document.getElementById('deviceNameMobile').textContent = deviceName;
  }
}

// Mobile rename button
document.getElementById('deviceNameEditBtn').addEventListener('click', function() {
  document.getElementById('nameInput').value = deviceName;
  document.getElementById('nameModal').hidden = false;
  document.getElementById('nameInput').focus();
});

function afterRegister() {
  loadFiles();
  connectSSE();
  loadSavePath();
  updateFileHint();
}

// ─── PC: Load Device List & Render UI ──────────────────────
function loadDevices() {
  apiFetch('/api/device/list').then(function(r) { return r.json(); }).then(function(devices) {
    allDevices = devices.filter(function(d) { return !d.isPC; });
    renderDevicePanel();
    renderTargetChips();
    renderFilterBar();
  }).catch(function() {});
}

function renderDevicePanel() {
  var list = document.getElementById('deviceList');
  var count = document.getElementById('deviceCount');
  count.textContent = allDevices.length;

  if (allDevices.length === 0) {
    list.innerHTML = '<div class="device-empty">暂无设备连接</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < allDevices.length; i++) {
    var d = allDevices[i];
    html +=
      '<div class="device-item">' +
        '<span class="device-status online"></span>' +
        '<span class="device-item-name">' + escHtml(d.name) + '</span>' +
      '</div>';
  }
  list.innerHTML = html;
}

function renderTargetChips() {
  var chips = document.getElementById('targetChips');
  var allSelected = selectedTargets.length === 0;
  var allLabel = allDevices.length === 0
    ? '<div class="chip-empty">暂无设备</div>'
    : '<button class="chip' + (allSelected ? ' chip-active' : '') + '" data-id="">全部设备</button>';

  var html = allLabel;
  for (var i = 0; i < allDevices.length; i++) {
    var d = allDevices[i];
    // Only show individual chip as active when it's explicitly in selectedTargets
    var active = !allSelected && selectedTargets.indexOf(d.id) !== -1;
    html += '<button class="chip' + (active ? ' chip-active' : '') + '" data-id="' + escAttr(d.id) + '">' + escHtml(d.name) + '</button>';
  }
  chips.innerHTML = html;
}

function renderFilterBar() {
  var bar = document.getElementById('filterBar');
  if (allDevices.length === 0) {
    bar.innerHTML = '';
    return;
  }
  var html = '<button class="filter-pill' + (filterDeviceId === '' ? ' pill-active' : '') + '" data-id="">全部</button>';
  for (var i = 0; i < allDevices.length; i++) {
    var d = allDevices[i];
    html += '<button class="filter-pill' + (filterDeviceId === d.id ? ' pill-active' : '') + '" data-id="' + escAttr(d.id) + '">' + escHtml(d.name) + '</button>';
  }
  bar.innerHTML = html;
  bar.hidden = false;
}

// ─── Event Delegation: Target Chips & Filter Pills ──────────
document.addEventListener('click', function(e) {
  var chip = e.target.closest('.chip');
  if (chip) {
    var id = chip.getAttribute('data-id');
    if (id === '') {
      // "All devices" clicked
      selectedTargets = [];
    } else {
      var idx = selectedTargets.indexOf(id);
      if (idx === -1) {
        selectedTargets.push(id);
      } else {
        selectedTargets.splice(idx, 1);
      }
    }
    renderTargetChips();
    return;
  }

  var pill = e.target.closest('.filter-pill');
  if (pill) {
    filterDeviceId = pill.getAttribute('data-id') || '';
    renderFilterBar();
    loadFiles();
    return;
  }
});

// ─── Tab Switching ──────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  document.getElementById('sentTab').className = tab === 'sent' ? 'tab active' : 'tab';
  document.getElementById('receivedTab').className = tab === 'received' ? 'tab active' : 'tab';
  document.getElementById('sentList').hidden = tab !== 'sent';
  document.getElementById('receivedList').hidden = tab !== 'received';
  if (tab === 'received') {
    pendingReceived = 0;
    updateBadge();
  }
  updateFileHint();
}

function updateFileHint() {
  var hint = document.getElementById('fileHint');
  if (isPC) {
    hint.textContent = activeTab === 'received'
      ? '⬇️ 手机上传后自动保存到电脑 下载/LAN Transfer/'
      : (selectedTargets.length > 0
          ? '⬆️ 文件将发送到选中的 ' + selectedTargets.length + ' 台设备'
          : '⬆️ 文件将发送到所有已连接设备');
  } else {
    hint.textContent = activeTab === 'received'
      ? '⬇️ 电脑发给你的文件在此显示'
      : '⬆️ 选文件直接上传到电脑';
  }
}

function updateBadge() {
  var el = document.getElementById('receivedTab');
  if (pendingReceived > 0 && activeTab !== 'received') {
    el.classList.add('tab-new');
  } else {
    el.classList.remove('tab-new');
  }
}

document.getElementById('sentTab').addEventListener('click', function() { switchTab('sent'); });
document.getElementById('receivedTab').addEventListener('click', function() { switchTab('received'); });

// ─── Load Server Info ───────────────────────────────────────
function loadInfo() {
  apiFetch('/api/info').then(function(res) { return res.json(); }).then(function(info) {
    serverInfo = info;
    var url = 'http://' + info.ip + ':' + info.port + '/?token=' + info.token;
    document.getElementById('serverUrl').textContent = url;
    if (typeof QRCode !== 'undefined' && isPC) {
      try {
        new QRCode(document.getElementById('qrcode'), {
          text: url, width: 190, height: 190,
          colorDark: '#1a1a2e', colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch(e) {}
    }
  }).catch(function() {
    document.getElementById('serverUrl').textContent = '⚠️ 无法连接服务器';
  });
}

// ─── Load Save Path ─────────────────────────────────────────
function loadSavePath() {
  if (!isPC) return;
  document.getElementById('savePath').textContent = '下载/LAN Transfer/';
}

document.getElementById('openSavePathBtn').addEventListener('click', function() {
  apiFetch('/api/open-save-path')
    .then(function(r) { return r.json(); })
    .then(function(d) { if (d.success) showToast('📂 已打开文件夹'); })
    .catch(function() { showToast('❌ 无法打开文件夹'); });
});

// ─── File List ──────────────────────────────────────────────
function loadFiles() {
  apiFetch('/api/files', { deviceAuth: !isPC }).then(function(res) { return res.json(); }).then(function(files) {
    renderFileLists(files);
  }).catch(function() {});
}

function renderFileLists(files) {
  if (!deviceId) return;
  if (!files) files = []; // defensive: some proxies/errors may yield null

  var sentFiles = [];
  var receivedFiles = [];

  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    if (f.uploadedBy === deviceId) {
      // Files uploaded by me
      if (filterDeviceId === '' || contains(f.sentTo, filterDeviceId) || !f.sentTo || f.sentTo.length === 0) {
        sentFiles.push(f);
      }
    } else {
      // Files from other devices that I can see
      if (filterDeviceId === '' || f.uploadedBy === filterDeviceId) {
        receivedFiles.push(f);
      }
    }
  }

  renderList('sentList', sentFiles, '📤 还没有发送文件', false);
  renderList('receivedList', receivedFiles, '📭 还没有收到文件', !isPC);
}

function contains(list, item) {
  if (!list) return false;
  for (var i = 0; i < list.length; i++) {
    if (list[i] === item) return true;
  }
  return false;
}

function getDeviceNameById(id) {
  if (id === deviceId) return deviceName;
  for (var i = 0; i < allDevices.length; i++) {
    if (allDevices[i].id === id) return allDevices[i].name;
  }
  return id ? id.substr(0, 8) : '未知';
}

function renderList(listId, files, emptyMsg, showDownload) {
  var el = document.getElementById(listId);
  if (!files || files.length === 0) {
    el.innerHTML = '<div class="empty-state"><p>' + emptyMsg + '</p></div>';
    return;
  }

  var icons = ['📄', '🖼️', '🎵', '🎬', '📦', '📊', '📝', '🗂️'];
  var html = '';
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var safeName = escAttr(f.name);

    // Show device context for PC
    var deviceLabel = '';
    if (isPC && f.uploadedBy === deviceId && f.sentTo && f.sentTo.length > 0) {
      var names = f.sentTo.map(getDeviceNameById).join(', ');
      deviceLabel = '<div class="file-device">→ ' + escHtml(names) + '</div>';
    } else if (isPC && f.uploadedBy !== deviceId) {
      deviceLabel = '<div class="file-device">📱 ' + escHtml(getDeviceNameById(f.uploadedBy)) + '</div>';
    }

    html +=
      '<div class="file-item">' +
        '<span class="file-icon">' + icons[i % icons.length] + '</span>' +
        '<div class="file-info">' +
          '<div class="file-name" title="' + safeName + '">' + escHtml(f.name) + '</div>' +
          '<div class="file-size">' + fmtSize(f.size) + ' · ' + fmtTime(f.modTime) + '</div>' +
          deviceLabel +
        '</div>' +
        '<div class="file-actions">' +
          (showDownload ? '<a class="btn btn-primary download-btn" href="' + escAttr(deviceApi('/api/download/' + encodeURIComponent(f.name))) + '" download data-file="' + safeName + '">下载</a>' : '') +
          (isPC ? '<button class="btn btn-danger delete-btn" data-name="' + safeName + '">删除</button>' : '') +
        '</div>' +
      '</div>';
  }
  el.innerHTML = html;
}

// ─── Event Delegation: Download / Delete ────────────────────
document.addEventListener('click', function(e) {
  var btn = e.target.closest('.download-btn');
  if (btn) {
    showToast('⬇️ 正在下载: ' + btn.getAttribute('data-file'));
    return;
  }
  var del = e.target.closest('.delete-btn');
  if (del) {
    var name = del.getAttribute('data-name');
    if (confirm('确定从列表中移除「' + name + '」？（磁盘文件仍保留）')) {
      apiFetch('/api/delete/' + encodeURIComponent(name), { method: 'DELETE' }).then(function() {
        loadFiles();
      }).catch(function() { showToast('❌ 删除失败'); });
    }
  }
});

// ─── Upload ─────────────────────────────────────────────────
var uploadBtn = document.getElementById('uploadBtn');
var fileInput = document.getElementById('fileInput');

uploadBtn.addEventListener('click', function() { fileInput.click(); });

fileInput.addEventListener('change', function() {
  for (var i = 0; i < fileInput.files.length; i++) {
    uploadFile(fileInput.files[i]);
  }
  fileInput.value = '';
});

function uploadFile(file) {
  var form = new FormData();
  form.append('file', file);

  var xhr = new XMLHttpRequest();
  var container = document.getElementById('progressContainer');
  var fill = document.getElementById('progressFill');
  var text = document.getElementById('progressText');

  container.hidden = false;
  text.textContent = '⬆️ ' + file.name;
  fill.style.width = '0%';

  // Build upload URL
  var uploadUrl = isPC
    ? withQuery('/api/upload', { token: token, deviceId: deviceId })
    : deviceApi('/api/upload');
  if (isPC && selectedTargets.length > 0) {
    uploadUrl += '&targets=' + encodeURIComponent(selectedTargets.join(','));
  }

  xhr.upload.onprogress = function(e) {
    if (e.lengthComputable) {
      fill.style.width = (e.loaded / e.total * 100) + '%';
    }
  };
  xhr.onload = function() {
    container.hidden = true;
    if (xhr.status === 200) {
      loadFiles();
      showToast(isPC ? '✅ 已发送' : '✅ 已上传到电脑');
    } else {
      showToast('❌ 失败: ' + (xhr.statusText || '未知错误'));
    }
  };
  xhr.onerror = function() {
    container.hidden = true;
    showToast('❌ 网络错误');
  };
  xhr.open('POST', uploadUrl);
  xhr.setRequestHeader('Authorization', 'Bearer ' + token);
  xhr.send(form);
}

// ─── SSE ────────────────────────────────────────────────────
var reconnectTimer = 0;

function connectSSE() {
  var url = isPC ? api('/api/events') : deviceApi('/api/events');
  var es = new EventSource(url);

  es.addEventListener('connected', function() {
    document.getElementById('statusDot').className = 'dot online';
    document.getElementById('statusText').textContent = '已连接';
    // Re-sync on every (re)connect: the file list lives in the server's
    // memory, so after the host restarts (possibly reusing the same port)
    // the page may be showing records the current host no longer knows.
    var container = document.querySelector('.container');
    if (container) container.hidden = false;
    var stopped = document.getElementById('view-service-stopped');
    if (stopped) stopped.hidden = true;
    loadFiles();
    if (isPC) { loadDevices(); }
  });

  es.addEventListener('file-added', function(e) {
    try {
      var file = JSON.parse(e.data);
      // Count as "new received" for badge if it's from someone else
      if (file.uploadedBy && file.uploadedBy !== deviceId) {
        pendingReceived++;
        updateBadge();
      }
    } catch(_) {}
    loadFiles();
  });
  es.addEventListener('file-deleted', function() { loadFiles(); });

  // When a mobile device connects or disconnects, refresh PC device list
  es.addEventListener('device-connected', function() {
    if (isPC) { loadDevices(); }
  });
  es.addEventListener('device-disconnected', function() {
    if (isPC) { loadDevices(); }
  });

  es.onerror = function() {
    es.close();
    clearTimeout(reconnectTimer);
    apiFetch('/api/info').then(function() {
      document.getElementById('statusDot').className = 'dot offline';
      document.getElementById('statusText').textContent = '重连中...';
      reconnectTimer = setTimeout(connectSSE, 3000);
    }).catch(function() {});
  };
}

// ─── Periodic Device List Refresh (PC only) ─────────────────
setInterval(function() {
  if (isPC) {
    loadDevices();
  }
}, 15000); // every 15 seconds

// ─── Start ──────────────────────────────────────────────────
loadInfo();
initDevice().then(function() {
  // deviceId is now set; subsequent calls use it
});
