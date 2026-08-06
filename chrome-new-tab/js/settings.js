const settings = {
  overlay: document.getElementById('settings-overlay'),
  btn: document.getElementById('settings-btn'),
  closeBtn: document.getElementById('settings-close'),

  init() {
    getLocalManifestVersion().then(version => {
      document.getElementById('settings-version').textContent = version;
    });
    this.btn.addEventListener('click', () => this.open());
    this.closeBtn.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => {
      // Don't close if text is selected (user was drag-selecting)
      if (e.target === this.overlay && !window.getSelection().toString()) this.close();
    });

    this.initBgOptions();
    this.initColorPicker();
    this.initImageUpload();
    this.initThemeSelector();
    this.initSearchEngine();
    this.initQuickLinksReset();
    this.initSyncBookmarks();
    this.initImportModal();
    this.initDataActions();
    this.initClearData();
    this.initWeatherSettings();
    this.initNewsSettings();
  },

  open() {
    this.overlay.classList.remove('hidden');
  },

  close() {
    this.overlay.classList.add('hidden');
  },

  initBgOptions() {
    const options = document.querySelectorAll('.bg-option');
    options.forEach(opt => {
      if (opt.dataset.bg === bg.type) {
        opt.classList.add('active');
        this.toggleBgSubOptions(bg.type);
      }
      opt.addEventListener('click', () => {
        options.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.toggleBgSubOptions(opt.dataset.bg);
        bg.setType(opt.dataset.bg);
      });
    });
  },

  toggleBgSubOptions(type) {
    document.getElementById('bg-color-picker').classList.toggle('hidden', type !== 'color');
    document.getElementById('bg-upload').classList.toggle('hidden', type !== 'custom');
  },

  initColorPicker() {
    const input = document.getElementById('color-input');
    const swatch = document.getElementById('color-swatch');
    const valueEl = document.getElementById('bg-color-value');
    const pasteEl = document.getElementById('bg-color-paste');
    const toastEl = document.getElementById('bg-color-toast');
    input.value = bg.color;
    swatch.style.background = bg.color;
    valueEl.textContent = bg.color;

    const setColor = (hex) => {
      input.value = hex;
      swatch.style.background = hex;
      bg.setColor(hex);
      valueEl.textContent = hex;
    };

    input.addEventListener('input', () => setColor(input.value));

    // 点击复制 + toast 提示
    valueEl.addEventListener('click', () => {
      navigator.clipboard.writeText(valueEl.textContent).then(() => {
        toastEl.classList.add('show');
        setTimeout(() => toastEl.classList.remove('show'), 1500);
      }).catch(() => {});
    });

    // 粘贴/输入颜色值
    pasteEl.addEventListener('input', () => {
      const raw = pasteEl.value.trim();
      const m = raw.match(/^#?([0-9a-f]{6})$/i);
      if (m) {
        setColor('#' + m[1].toLowerCase());
        pasteEl.classList.add('success');
        setTimeout(() => pasteEl.classList.remove('success'), 1200);
      }
    });
    pasteEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const raw = pasteEl.value.trim();
        const m = raw.match(/^#?([0-9a-f]{6})$/i);
        if (m) {
          setColor('#' + m[1].toLowerCase());
          pasteEl.classList.add('success');
          setTimeout(() => pasteEl.classList.remove('success'), 1200);
        }
      }
    });
  },

  initImageUpload() {
    const input = document.getElementById('image-input');
    const nameEl = document.getElementById('bg-upload-name');
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      nameEl.textContent = file.name;
      nameEl.title = file.name;
      const reader = new FileReader();
      reader.onload = (e) => bg.setImage(e.target.result);
      reader.readAsDataURL(file);
    });
  },

  async initThemeSelector() {
    const data = await Storage.get(['theme', 'glitchEnabled']);
    const current = data.theme || 'default';
    this._glitchEnabled = data.glitchEnabled !== false;
    this._applyTheme(current, { syncBackground: false });

    const container = document.getElementById('theme-options');
    container.innerHTML = '';

    for (const [id, theme] of Object.entries(THEMES)) {
      const btn = document.createElement('button');
      btn.className = 'theme-option' + (id === current ? ' active' : '');
      btn.dataset.theme = id;

      const preview = document.createElement('div');
      preview.className = 'theme-preview';
      theme.preview.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'theme-swatch';
        swatch.style.background = color;
        preview.appendChild(swatch);
      });

      const name = document.createElement('span');
      name.className = 'theme-name';
      name.textContent = theme.name;

      btn.append(preview, name);

      // Glitch toggle for cyber theme
      if (id === 'cyber') {
        const toggleRow = document.createElement('div');
        toggleRow.className = 'glitch-toggle';

        const toggleLabel = document.createElement('span');
        toggleLabel.className = 'glitch-toggle-label';
        toggleLabel.textContent = '故障效果';

        const toggleSwitch = document.createElement('button');
        toggleSwitch.className = 'glitch-toggle-switch' + (this._glitchEnabled ? ' active' : '');
        toggleSwitch.setAttribute('role', 'switch');
        toggleSwitch.setAttribute('aria-checked', String(this._glitchEnabled));
        toggleSwitch.innerHTML = '<span class="glitch-toggle-knob"></span>';

        toggleSwitch.addEventListener('click', (e) => {
          e.stopPropagation();
          this._glitchEnabled = !this._glitchEnabled;
          toggleSwitch.classList.toggle('active', this._glitchEnabled);
          toggleSwitch.setAttribute('aria-checked', String(this._glitchEnabled));
          Storage.set({ glitchEnabled: this._glitchEnabled });
          // Apply immediately if cyber is active
          if (document.documentElement.dataset.theme === 'cyber') {
            if (this._glitchEnabled) {
              this._startGlitch();
            } else {
              this._stopGlitch();
            }
          }
        });

        toggleRow.append(toggleLabel, toggleSwitch);
        btn.appendChild(toggleRow);
      }

      btn.addEventListener('click', () => {
        container.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
        btn.classList.add('active');
        this._applyTheme(id, { syncBackground: true });
        Storage.set({ theme: id });
      });

      container.appendChild(btn);
    }
  },

  _applyTheme(themeId, options = {}) {
    const { syncBackground = true } = options;
    if (themeId && themeId !== 'default') {
      document.documentElement.dataset.theme = themeId;
    } else {
      delete document.documentElement.dataset.theme;
    }
    if (syncBackground && typeof bg !== 'undefined' && bg.setTheme) bg.setTheme(themeId || 'default');
    // Overlay visibility is controlled by theme (atmosphere layer)
    const overlay = document.getElementById('glitch-overlay');
    if (overlay) {
      overlay.style.display = (themeId === 'cyber') ? 'block' : 'none';
    }
    // Glitch disruptions only if enabled
    if (themeId === 'cyber' && this._glitchEnabled) {
      this._startGlitch();
    } else {
      this._stopGlitch();
    }
  },

  _glitchTimer: null,
  _glitchAnimations: [],
  _glitchEnabled: true,

  _startGlitch() {
    this._stopGlitch();
    const effects = document.getElementById('glitch-effects');
    if (!effects) return;

    const schedule = () => {
      this._glitchTimer = setTimeout(() => {
        this._triggerGlitch(effects);
        schedule();
      }, 1000 + Math.random() * 4000);
    };
    schedule();
  },

  _stopGlitch() {
    if (this._glitchTimer) {
      clearTimeout(this._glitchTimer);
      this._glitchTimer = null;
    }
    this._glitchAnimations.forEach(a => a.cancel());
    this._glitchAnimations = [];
    const effects = document.getElementById('glitch-effects');
    if (effects) {
      effects.classList.remove('active');
      effects.innerHTML = '';
    }
  },

  // Preset jump distances for glitch jitter (pixels)
  _GLITCH_DISTANCES: [2, 4, 6, 8, 10, 14, 18, 22, 26, 30],

  _generateJitterKeyframes(jumpCount) {
    const D = this._GLITCH_DISTANCES;
    const frames = [];
    const pushFrame = (transform, offset) => {
      const nextOffset = Math.min(0.999, Math.max((frames.at(-1)?.offset ?? -0.001) + 0.001, offset));
      frames.push({ transform, offset: nextOffset });
      return nextOffset;
    };

    pushFrame('translateX(0px)', 0);

    let t = 0.05;
    for (let i = 0; i < jumpCount; i++) {
      const dir = Math.random() > 0.5 ? 1 : -1;
      const dist = D[Math.floor(Math.random() * D.length)];
      const offset = dir * dist;

      // Snap to new position
      const snapAt = pushFrame(`translateX(${offset}px)`, t);
      // Hold at this position (120-220ms at 1s duration)
      const holdEnd = pushFrame(`translateX(${offset}px)`, snapAt + 0.12 + Math.random() * 0.1);
      // Snap back to 0
      const returnAt = pushFrame('translateX(0px)', holdEnd + 0.02);

      t = returnAt + 0.05 + Math.random() * 0.05;
      if (t >= 0.98) break;
    }

    pushFrame('translateX(0px)', 1);
    return frames;
  },

  _triggerGlitch(effects) {
    effects.innerHTML = '';
    const isIntense = Math.random() > 0.5;
    const tearCount = isIntense ? 1 + Math.floor(Math.random() * 2) : 1;
    const blockCount = isIntense ? 3 + Math.floor(Math.random() * 5) : 1 + Math.floor(Math.random() * 3);
    const state = isIntense ? 'intense' : 'calm';
    const dur = 900 + Math.random() * 200;
    const jumpCount = isIntense ? 3 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2);

    const anims = [];
    const keyframes = this._generateJitterKeyframes(jumpCount);

    // Screen tear lines
    for (let i = 0; i < tearCount; i++) {
      const tear = document.createElement('div');
      tear.className = 'glitch-tear ' + state;
      tear.style.top = (10 + Math.random() * 75) + '%';
      tear.style.left = (Math.random() * 10) + '%';
      tear.style.width = (80 + Math.random() * 20) + '%';
      effects.appendChild(tear);

      anims.push(tear.animate(keyframes, { duration: dur, fill: 'forwards' }));
    }

    // Glitch blocks
    const colors = ['#00f0ff', '#ff0080', '#ffe600', '#b000ff'];
    for (let i = 0; i < blockCount; i++) {
      const block = document.createElement('div');
      block.className = 'glitch-block ' + state;
      const yBase = 5 + Math.random() * 85;
      const yOff = (Math.random() - 0.5) * 8;
      block.style.top = (yBase + yOff) + '%';
      block.style.left = (5 + Math.random() * 70) + '%';
      block.style.width = (10 + Math.random() * 100) + 'px';
      block.style.height = (4 + Math.random() * 16) + 'px';
      block.style.background = colors[Math.floor(Math.random() * colors.length)];
      block.style.opacity = (0.15 + Math.random() * 0.35);
      if (isIntense && Math.random() > 0.6) {
        block.classList.add('rgb');
      }
      effects.appendChild(block);

      anims.push(block.animate(keyframes, { duration: dur, fill: 'forwards' }));
    }

    effects.classList.add('active');
    this._glitchAnimations.push(...anims);

    setTimeout(() => {
      effects.classList.remove('active');
      effects.innerHTML = '';
      this._glitchAnimations = this._glitchAnimations.filter(a => !anims.includes(a));
    }, dur + 50);
  },

  async initSearchEngine() {
    const data = await Storage.get(['searchEngine']);
    const saved = data.searchEngine || 'google';
    this.renderEngineList(saved);
    this.initEngineModal();
  },

  renderEngineList(activeId) {
    const list = document.getElementById('se-manage-list');
    const all = search.getAllEngines();
    list.innerHTML = '';

    all.forEach(engine => {
      const item = document.createElement('div');
      item.className = 'se-manage-item' + (engine.id === activeId ? ' active' : '');
      item.dataset.engine = engine.id;

      item.addEventListener('click', () => search.setEngine(engine.id));

      // Icon
      const iconDiv = document.createElement('div');
      iconDiv.className = 'se-manage-icon';
      if (engine.icon) {
        const img = document.createElement('img');
        img.src = engine.icon;
        img.alt = '';
        img.addEventListener('error', function () {
          const span = document.createElement('span');
          span.className = 'se-manage-fallback';
          span.textContent = Array.from(engine.name)[0] || '?';
          this.replaceWith(span);
        });
        iconDiv.appendChild(img);
      } else {
        const span = document.createElement('span');
        span.className = 'se-manage-fallback';
        span.textContent = Array.from(engine.name)[0] || '?';
        iconDiv.appendChild(span);
      }
      item.appendChild(iconDiv);

      // Name
      const nameSpan = document.createElement('span');
      nameSpan.className = 'se-manage-name';
      nameSpan.textContent = engine.name;
      item.appendChild(nameSpan);

      // Active badge
      if (engine.id === activeId) {
        const badge = document.createElement('span');
        badge.className = 'se-manage-badge';
        badge.textContent = '当前';
        item.appendChild(badge);
      }

      // Edit button
      const editBtn = document.createElement('button');
      editBtn.className = 'se-manage-edit';
      editBtn.textContent = '编辑';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showEngineModal(engine.id);
      });
      item.appendChild(editBtn);

      // Delete button
      const delBtn = document.createElement('button');
      delBtn.className = 'se-manage-delete';
      delBtn.textContent = '删除';
      if (search.count <= 1) delBtn.disabled = true;
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm(`确定删除搜索引擎「${engine.name}」？`)) return;
        this.deleteEngine(engine.id);
      });
      item.appendChild(delBtn);

      list.appendChild(item);
    });
  },

  async deleteEngine(id) {
    await search.deleteEngine(id);
    this.renderEngineList(search.engine);
  },

  _editingEngineId: null,

  initImportModal() {
    const overlay = document.getElementById('import-modal-overlay');
    const closeBtn = document.getElementById('import-modal-close');

    document.getElementById('ql-import-btn').addEventListener('click', () => {
      overlay.classList.remove('hidden');
    });

    closeBtn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      document.getElementById('import-modal-status').classList.add('hidden');
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
        document.getElementById('import-modal-status').classList.add('hidden');
      }
    });

    // File import
    document.getElementById('import-file-btn').addEventListener('click', () => {
      document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', (e) => {
      this.importConfig(e);
    });

    // URL import
    const urlInput = document.getElementById('import-url-input');
    const urlBtn = document.getElementById('import-url-btn');
    urlBtn.addEventListener('click', () => this.importConfigFromUrl());
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.importConfigFromUrl();
    });
  },

  _validConfigKeys: CONFIG_KEYS,

  _validateImportData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    return Object.keys(data).length === 0 || this._validConfigKeys.some(key => key in data);
  },

  _setImportStatus(type, msg) {
    const el = document.getElementById('import-modal-status');
    if (!type) {
      el.classList.add('hidden');
      return;
    }
    el.className = type;
    el.textContent = msg;
  },

  async _applyImportData(data) {
    await Storage.remove(CONFIG_CLEAR_KEYS);
    if (Object.keys(data).length > 0) {
      await Storage.set(data);
    }
    this._setImportStatus('success', '配置导入成功，正在刷新...');
    setTimeout(() => location.reload(), 800);
  },

  async importConfig(e) {
    const file = e.target.files[0];
    if (!file) return;
    this._setImportStatus('loading', '正在解析文件...');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!this._validateImportData(data)) {
        this._setImportStatus('error', '文件格式不匹配，不是有效的配置文件');
        return;
      }
      await this._applyImportData(data);
    } catch {
      this._setImportStatus('error', '无法解析 JSON 文件');
    }
  },

  async importConfigFromUrl() {
    const input = document.getElementById('import-url-input');
    const btn = document.getElementById('import-url-btn');
    const url = input.value.trim();
    if (!url) return;

    btn.disabled = true;
    this._setImportStatus('loading', '正在下载配置...');

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const text = await resp.text();
      const data = JSON.parse(text);

      if (!this._validateImportData(data)) {
        this._setImportStatus('error', '格式不匹配，不是有效的配置文件');
        btn.disabled = false;
        return;
      }

      this._setImportStatus('loading', '格式验证通过，正在应用...');
      await this._applyImportData(data);
    } catch (err) {
      if (err.name === 'SyntaxError') {
        this._setImportStatus('error', 'URL 返回的内容不是有效 JSON');
      } else {
        this._setImportStatus('error', '下载失败：' + err.message);
      }
      btn.disabled = false;
    }
  },

  initEngineModal() {
    document.getElementById('se-add-btn').addEventListener('click', () => this.showEngineModal());
    document.getElementById('se-add-cancel').addEventListener('click', () => this.hideEngineModal());
    document.getElementById('se-add-save').addEventListener('click', () => this.saveEngine());
    document.getElementById('se-modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.hideEngineModal();
    });
    document.getElementById('se-add-url').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.saveEngine();
    });
  },

  showEngineModal(engineId) {
    const overlay = document.getElementById('se-modal-overlay');
    const title = overlay.querySelector('h3');
    const saveBtn = document.getElementById('se-add-save');

    if (engineId) {
      const engine = search.getEngine(engineId);
      if (!engine) return;
      document.getElementById('se-add-name').value = engine.name;
      document.getElementById('se-add-url').value = engine.url;
      document.getElementById('se-add-icon').value = engine.icon || '';
      this._editingEngineId = engineId;
      title.textContent = '编辑搜索引擎';
      saveBtn.textContent = '保存';
    } else {
      if (search.count >= 10) {
        alert('最多只能添加 10 个搜索引擎');
        return;
      }
      document.getElementById('se-add-name').value = '';
      document.getElementById('se-add-url').value = '';
      document.getElementById('se-add-icon').value = '';
      this._editingEngineId = null;
      title.textContent = '新增搜索引擎';
      saveBtn.textContent = '添加';
    }

    overlay.classList.remove('hidden');
    document.getElementById('se-add-name').focus();
  },

  hideEngineModal() {
    document.getElementById('se-modal-overlay').classList.add('hidden');
    this._editingEngineId = null;
  },

  async saveEngine() {
    const name = document.getElementById('se-add-name').value.trim();
    const url = document.getElementById('se-add-url').value.trim();
    if (!name || !url) return;

    const icon = document.getElementById('se-add-icon').value.trim() || null;
    let normalized = url;
    if (!/^https?:\/\//.test(normalized)) normalized = 'https://' + normalized;

    if (this._editingEngineId) {
      if (BUILTIN_ENGINES[this._editingEngineId]) {
        // Built-in engine: hide the original, create/update custom entry with same id
        if (!search.hiddenEngines.includes(this._editingEngineId)) {
          search.hiddenEngines.push(this._editingEngineId);
        }
        const existing = search.customEngines.find(e => e.id === this._editingEngineId);
        if (existing) {
          existing.name = name;
          existing.url = normalized;
          existing.icon = icon;
        } else {
          search.customEngines.push({ id: this._editingEngineId, name, url: normalized, icon });
        }
      } else {
        // Custom engine: update directly
        const engine = search.customEngines.find(e => e.id === this._editingEngineId);
        if (engine) {
          engine.name = name;
          engine.url = normalized;
          engine.icon = icon;
        }
      }
      await Storage.set({ customEngines: search.customEngines, hiddenEngines: search.hiddenEngines });
      search.buildDropdown();
    } else {
      const id = 'custom_' + Date.now();
      search.customEngines.push({ id, name, url: normalized, icon });
      await Storage.set({ customEngines: search.customEngines });
      search.buildDropdown();
    }

    this.hideEngineModal();
    this.renderEngineList(search.engine);
  },

  initQuickLinksReset() {
    document.getElementById('ql-reset-btn').addEventListener('click', async () => {
      if (!confirm('确定清空所有快捷链接？')) return;
      if (!confirm('再次确认：此操作不可撤销，将删除所有快捷链接。')) return;
      quickLinks.links = [];
      await quickLinks.save();
      quickLinks.render();
    });
  },

  initSyncBookmarks() {
    const MAX_QL = 200;

    function testImageLoad(src, timeoutMs = 3000) {
      return Promise.race([
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = src;
        }),
        new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
      ]);
    }

    async function fetchIconForUrl(url) {
      let domain;
      try { domain = new URL(url).hostname; } catch { return null; }

      // 1. xinac API 优先，可检测默认图标
      let xinacUrl = `https://api.xinac.net/icon/?url=${domain}`;
      let xinacFoundDefault = false;
      try {
        const resp = await fetch(xinacUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          if (await isXinacDefaultIcon(blob)) {
            xinacFoundDefault = true;
          } else if (await testImageLoad(xinacUrl)) {
            return xinacUrl;
          }
        }
      } catch {
        if (await testImageLoad(xinacUrl)) return xinacUrl;
      }
      // xinac 确认无图标，跳过后续尝试
      if (xinacFoundDefault) return null;

      // 2. Chrome 缓存（局域网站点）
      const chromeFaviconUrl = chrome.runtime.getURL('_favicon/?pageUrl=' + encodeURIComponent(url) + '&size=64');
      if (await testImageLoad(chromeFaviconUrl)) return chromeFaviconUrl;

      // 3. 直接请求 /favicon.ico
      const directUrl = `https://${domain}/favicon.ico`;
      if (await testImageLoad(directUrl, 5000)) return directUrl;

      // 4. 解析页面 HTML 提取图标
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const resp = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (resp.ok) {
          const html = await resp.text();
          const m = html.match(/<link[^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*href=["']([^"']+)["']/i);
          if (m) return new URL(m[1], url).href;
        }
      } catch { /* ignore */ }
      return null;
    }

    // ---- tree helpers ----
    function collectUrls(nodes) {
      const result = [];
      for (const n of nodes) {
        if (n.url) result.push({ id: n.id, name: n.title || n.url, url: n.url });
        if (n.children) result.push(...collectUrls(n.children));
      }
      return result;
    }

    // ---- state ----
    let bmTree = [];
    const selected = new Set();   // bookmark node ids
    const expanded = new Set();   // folder node ids

    function renderTree() {
      const container = document.getElementById('bm-tree');
      container.innerHTML = '';
      if (!bmTree.length) {
        container.innerHTML = '<div class="bm-tree-empty">收藏夹为空</div>';
        return;
      }
      for (const node of bmTree) {
        container.appendChild(renderNode(node, 0));
      }
    }

    function renderNode(node, depth) {
      const isFolder = !node.url;
      const isExpanded = expanded.has(node.id);

      if (isFolder) {
        const wrapper = document.createElement('div');

        const row = document.createElement('div');
        row.className = 'bm-folder';
        row.style.paddingLeft = (8 + depth * 20) + 'px';

        const toggle = document.createElement('button');
        toggle.className = 'bm-toggle' + (isExpanded ? ' expanded' : '');
        toggle.textContent = '▶';
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          if (isExpanded) expanded.delete(node.id);
          else expanded.add(node.id);
          renderTree();
          updateCount();
        });
        row.appendChild(toggle);

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        const urls = collectUrls([node]);
        const allSelected = urls.length > 0 && urls.every(u => selected.has(u.id));
        const someSelected = urls.some(u => selected.has(u.id));
        cb.checked = allSelected;
        cb.indeterminate = someSelected && !allSelected;
        cb.addEventListener('change', () => {
          for (const u of urls) {
            if (cb.checked) selected.add(u.id);
            else selected.delete(u.id);
          }
          renderTree();
          updateCount();
        });
        row.appendChild(cb);

        const icon = document.createElement('span');
        icon.className = 'bm-folder-icon';
        icon.textContent = '📁';
        row.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'bm-folder-name';
        name.textContent = node.title || '(无标题)';
        row.appendChild(name);

        wrapper.appendChild(row);

        if (isExpanded && node.children) {
          const children = document.createElement('div');
          children.className = 'bm-children';
          for (const child of node.children) {
            children.appendChild(renderNode(child, depth + 1));
          }
          wrapper.appendChild(children);
        }

        return wrapper;
      } else {
        // bookmark leaf
        const row = document.createElement('div');
        row.className = 'bm-item';
        row.style.paddingLeft = (28 + depth * 20) + 'px';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selected.has(node.id);
        cb.addEventListener('change', () => {
          if (cb.checked) selected.add(node.id);
          else selected.delete(node.id);
          updateCount();
          // update parent folder indeterminate state
          renderTree();
        });
        row.appendChild(cb);

        const icon = document.createElement('span');
        icon.className = 'bm-item-icon';
        if (node.icon) {
          const img = document.createElement('img');
          img.src = node.icon;
          img.alt = '';
          img.addEventListener('error', () => { icon.textContent = '🌐'; });
          icon.appendChild(img);
        } else {
          icon.textContent = '🌐';
        }
        row.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'bm-item-name';
        name.textContent = node.title || node.url;
        row.appendChild(name);

        const urlLabel = document.createElement('span');
        urlLabel.className = 'bm-item-url';
        try { urlLabel.textContent = new URL(node.url).hostname; } catch { urlLabel.textContent = ''; }
        row.appendChild(urlLabel);

        return row;
      }
    }

    function updateCount() {
      document.getElementById('bm-count').textContent = `已选择 ${selected.size} 个`;
      const confirmBtn = document.getElementById('bm-confirm');
      confirmBtn.disabled = selected.size === 0;
      // sync select-all checkbox
      const allItems = collectUrls(bmTree);
      const allCb = document.getElementById('bm-select-all');
      if (allItems.length > 0) {
        allCb.checked = allItems.every(u => selected.has(u.id));
        allCb.indeterminate = allItems.some(u => selected.has(u.id)) && !allCb.checked;
      } else {
        allCb.checked = false;
        allCb.indeterminate = false;
      }
    }

    function initTreeIcons(nodes) {
      for (const n of nodes) {
        if (n.url) {
          (async () => {
            try {
              const domain = new URL(n.url).hostname;
              const iconUrl = `https://api.xinac.net/icon/?url=${domain}`;
              if (await testImageLoad(iconUrl)) n.icon = iconUrl;
            } catch { /* ignore */ }
          })();
        }
        if (n.children) initTreeIcons(n.children);
      }
    }

    // ---- open modal ----
    document.getElementById('ql-sync-btn').addEventListener('click', async () => {
      let tree;
      try {
        tree = await chrome.bookmarks.getTree();
      } catch {
        alert('获取收藏夹失败，请确认已授予书签权限。');
        return;
      }

      // tree[0] is the root, its children are the bookmark roots
      bmTree = tree[0].children || [];
      selected.clear();
      expanded.clear();
      // expand first level by default
      for (const n of bmTree) {
        if (!n.url) expanded.add(n.id);
      }

      renderTree();
      updateCount();
      document.getElementById('bm-modal-overlay').classList.remove('hidden');
      // pre-fetch tree icons in background
      initTreeIcons(bmTree);
    });

    // ---- modal events ----
    document.getElementById('bm-close').addEventListener('click', () => {
      document.getElementById('bm-modal-overlay').classList.add('hidden');
    });
    document.getElementById('bm-cancel').addEventListener('click', () => {
      document.getElementById('bm-modal-overlay').classList.add('hidden');
    });
    document.getElementById('bm-modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        document.getElementById('bm-modal-overlay').classList.add('hidden');
      }
    });

    // select all
    document.getElementById('bm-select-all').addEventListener('change', function () {
      const allItems = collectUrls(bmTree);
      if (this.checked) {
        for (const u of allItems) selected.add(u.id);
      } else {
        selected.clear();
      }
      renderTree();
      updateCount();
    });

    // confirm import
    document.getElementById('bm-confirm').addEventListener('click', async () => {
      if (selected.size === 0) return;

      const allSelected = collectUrls(bmTree).filter(u => selected.has(u.id));

      // dedup against existing quick links
      const existingUrls = new Set(quickLinks.links.map(l => l.url.replace(/\/+$/, '').toLowerCase()));
      const newLinks = [];
      for (const u of allSelected) {
        const key = u.url.replace(/\/+$/, '').toLowerCase();
        if (!existingUrls.has(key)) {
          newLinks.push(u);
          existingUrls.add(key);
        }
      }

      if (newLinks.length === 0) {
        alert('所选网站已全部在快捷链接中，无需重复导入。');
        document.getElementById('bm-modal-overlay').classList.add('hidden');
        return;
      }

      // check max limit
      let toAdd = newLinks;
      const remaining = MAX_QL - quickLinks.links.length;
      const truncated = newLinks.length > remaining ? newLinks.length - remaining : 0;
      if (remaining <= 0) {
        alert('快捷链接已满（上限 200 个），无法继续导入。');
        return;
      }
      if (remaining < newLinks.length) {
        toAdd = newLinks.slice(0, remaining);
      }

      document.getElementById('bm-modal-overlay').classList.add('hidden');

      // loading state
      const btn = document.getElementById('ql-sync-btn');
      btn.disabled = true;
      const loading = document.createElement('div');
      loading.className = 'se-sync-loading';
      loading.innerHTML = '<div class="se-sync-loading-spinner"></div><div class="se-sync-loading-text">正在获取图标并导入...</div>';
      document.getElementById('settings-panel').appendChild(loading);

      let iconResults;
      try {
        const batchTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 30000)
        );
        iconResults = await Promise.race([
          Promise.allSettled(toAdd.map(u => fetchIconForUrl(u.url))),
          batchTimeout,
        ]);
      } catch {
        iconResults = toAdd.map(() => ({ status: 'rejected' }));
      } finally {
        loading.remove();
        btn.disabled = false;
      }

      for (let i = 0; i < toAdd.length; i++) {
        const pos = quickLinks.findFirstEmpty();
        quickLinks.links.push({
          name: toAdd[i].name,
          url: toAdd[i].url,
          icon: iconResults[i].status === 'fulfilled' ? iconResults[i].value : null,
          col: pos.col,
          row: pos.row,
        });
      }
      await quickLinks.save();
      quickLinks.render();
      alert(`✅ 成功导入 ${toAdd.length} 个${truncated > 0 ? `（超出上限截断 ${truncated} 个）` : ''}`);
    });
  },

  initDataActions() {
    document.getElementById('ql-export-btn').addEventListener('click', () => this.exportConfig());
  },

  async exportConfig() {
    const data = await Storage.get(CONFIG_KEYS);
    const config = exportConfigData(data);
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'newtab-config.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  initClearData() {
    const btn = document.getElementById('ql-clear-btn');
    btn.addEventListener('click', async () => {
      if (!confirm('确定清除所有数据？这将恢复新标签页到初始状态。')) return;
      await Storage.remove(CONFIG_CLEAR_KEYS);
      this._applyTheme('default', { syncBackground: false });
      quickLinks.links = [];
      quickLinks.render();
      bg.theme = 'default';
      bg.type = 'gradient';
      bg.color = CONFIG_DEFAULTS.bgColor;
      bg.imageData = null;
      bg.apply();
      search.engine = 'google';
      search.updateSwitcher();
      location.reload();
    });
  },

  _createCustomSelect(selectEl) {
    if (!selectEl || selectEl.parentNode.classList.contains('cs-initialized')) return;
    const wrapper = selectEl.closest('.cs-wrapper') || selectEl.parentNode;
    wrapper.classList.add('cs-initialized');
    selectEl.style.display = 'none';

    const trigger = document.createElement('button');
    trigger.className = 'cs-trigger';
    trigger.type = 'button';

    const dropdown = document.createElement('div');
    dropdown.className = 'cs-dropdown hidden';

    function syncOptions() {
      const val = selectEl.value;
      dropdown.innerHTML = '';
      let found = false;
      for (const opt of selectEl.options) {
        if (!opt.value && opt === selectEl.options[0]) continue;
        const item = document.createElement('div');
        item.className = 'cs-option';
        if (opt.value === val) { item.classList.add('selected'); found = true; }
        item.textContent = opt.textContent;
        item.dataset.value = opt.value;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          selectEl.value = opt.value;
          trigger.textContent = opt.textContent;
          dropdown.classList.add('hidden');
          dropdown.querySelectorAll('.cs-option').forEach(o => o.classList.remove('selected'));
          item.classList.add('selected');
          selectEl.dispatchEvent(new Event('change'));
        });
        dropdown.appendChild(item);
      }
      if (!found && selectEl.options.length > 0) {
        trigger.textContent = selectEl.options[0].textContent;
      }
    }

    function updateTriggerText() {
      const selOpt = selectEl.options[selectEl.selectedIndex];
      trigger.textContent = selOpt ? selOpt.textContent : (selectEl.options[0]?.textContent || '');
    }

    selectEl.addEventListener('change', updateTriggerText);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (selectEl.disabled) return;
      document.querySelectorAll('.cs-dropdown:not(.hidden)').forEach(d => {
        if (d !== dropdown) d.classList.add('hidden');
      });
      syncOptions();
      dropdown.classList.toggle('hidden');
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);

    document.addEventListener('click', () => dropdown.classList.add('hidden'), { capture: true });

    const obs = new MutationObserver(() => { trigger.disabled = selectEl.disabled; });
    obs.observe(selectEl, { attributes: true, attributeFilter: ['disabled'] });
    trigger.disabled = selectEl.disabled;

    updateTriggerText();
    return { syncOptions, updateTriggerText };
  },

  initNewsSettings() {
    const toggle = document.getElementById('news-enabled-toggle');
    if (!toggle) return;

    Storage.get(['newsEnabled']).then((data) => {
      toggle.checked = data.newsEnabled !== false;
    });

    toggle.addEventListener('change', async () => {
      if (typeof newsService !== 'undefined') {
        await newsService.setEnabled(toggle.checked);
      } else {
        await Storage.set({ newsEnabled: toggle.checked });
      }
    });
  },

  initWeatherSettings() {
    const displayToggle = document.getElementById('weather-display-toggle');
    const provSelect = document.getElementById('weather-province');
    const citySelect = document.getElementById('weather-city-select');
    const districtSelect = document.getElementById('weather-district');
    const applyBtn = document.getElementById('weather-location-apply');
    const previewBtn = document.getElementById('weather-location-preview');
    const locStatus = document.getElementById('weather-location-status');
    const currentCityEl = document.getElementById('weather-current-city');

    const DIV_CACHE_VERSION = 3;

    // Load data cache
    let _provinceData = [];
    let _cityData = [];
    let _districtData = [];
    let _provinceBundleCache = new Map();

    async function loadDivisions() {
      const cached = await Storage.get(['_divCache']);
      const now = Date.now();
      if (cached._divCache && cached._divCache.version === DIV_CACHE_VERSION && now - cached._divCache.ts < 86400000) {
        _provinceData = cached._divCache.provinces || [];
        return;
      }
      try {
        const resp = await fetch('data/provinces.json');
        if (resp.ok) _provinceData = await resp.json();
        await Storage.set({
          _divCache: {
            version: DIV_CACHE_VERSION,
            provinces: _provinceData,
            ts: now,
          },
        });
      } catch { /* ignore */ }
    }

    async function loadProvinceBundle(provinceCode) {
      if (!provinceCode) {
        _cityData = [];
        _districtData = [];
        return null;
      }

      if (_provinceBundleCache.has(provinceCode)) {
        const cachedBundle = _provinceBundleCache.get(provinceCode);
        _cityData = cachedBundle.cities || [];
        _districtData = _cityData.flatMap(city => city.areas || []);
        return cachedBundle;
      }

      try {
        const resp = await fetch(`data/provinces_${provinceCode}_cities_areas.json`);
        if (!resp.ok) throw new Error('bundle not found');
        const bundle = await resp.json();
        _provinceBundleCache.set(provinceCode, bundle);
        _cityData = bundle.cities || [];
        _districtData = _cityData.flatMap(city => city.areas || []);
        return bundle;
      } catch {
        _cityData = [];
        _districtData = [];
        return null;
      }
    }

    function _getDivisionByCode(list, code) {
      if (!code) return null;
      return list.find(item => item.code === code) || null;
    }

    function _getCoords(item) {
      if (!item) return null;
      const latitude = Number(item.latitude ?? item.lat);
      const longitude = Number(item.longitude ?? item.lng);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return { latitude, longitude };
    }

    function _formatLocationName(cityItem, districtItem, provinceItem) {
      const parts = [];
      if (districtItem) parts.push(districtItem.name);
      if (cityItem) parts.push(cityItem.name);
      if (provinceItem) parts.push(provinceItem.name);
      return parts.join(', ');
    }

    function _resolveWeatherLocation() {
      const provinceItem = _getDivisionByCode(_provinceData, provSelect?.value);
      const cityItem = _getDivisionByCode(_cityData, citySelect?.value);
      const districtItem = _getDivisionByCode(_districtData, districtSelect?.value);
      const districtCoords = _getCoords(districtItem);
      if (districtCoords) {
        return {
          coords: districtCoords,
          level: 'district',
          name: _formatLocationName(cityItem, districtItem, provinceItem),
        };
      }
      const cityCoords = _getCoords(cityItem);
      if (cityCoords) {
        return {
          coords: cityCoords,
          level: 'city',
          name: _formatLocationName(cityItem, null, provinceItem),
        };
      }
      return null;
    }

    async function updateCitySelect(autoSelectFirst = false) {
      const pCode = provSelect.value;
      citySelect.innerHTML = '<option value="">城市</option>';
      citySelect.disabled = !pCode;
      districtSelect.innerHTML = '<option value="">区县</option>';
      districtSelect.disabled = true;
      if (!pCode) return;
      const bundle = await loadProvinceBundle(pCode);
      const cities = bundle?.cities || [];
      for (const c of cities) {
        const opt = document.createElement('option');
        opt.value = c.code;
        opt.textContent = c.name;
        citySelect.appendChild(opt);
      }
      if (cities.length === 0) return;
      const nextCityCode = autoSelectFirst ? cities[0].code : (citySelect.value && cities.some(c => c.code === citySelect.value) ? citySelect.value : cities[0].code);
      citySelect.value = nextCityCode;
      if (cityCS) cityCS.syncOptions();
      citySelect.dispatchEvent(new Event('change'));
    }

    function updateDistrictSelect(autoSelectFirst = false) {
      const cCode = citySelect.value;
      districtSelect.innerHTML = '<option value="">区县</option>';
      districtSelect.disabled = !cCode;
      if (!cCode) return;
      const dists = _districtData.filter(d => d.cityCode === cCode);
      for (const d of dists) {
        const opt = document.createElement('option');
        opt.value = d.code;
        opt.textContent = d.name;
        districtSelect.appendChild(opt);
      }
      if (dists.length === 0) {
        if (districtCS) districtCS.syncOptions();
        return;
      }
      const nextDistrictCode = autoSelectFirst ? dists[0].code : (districtSelect.value && dists.some(d => d.code === districtSelect.value) ? districtSelect.value : dists[0].code);
      districtSelect.value = nextDistrictCode;
      if (districtCS) districtCS.syncOptions();
      districtSelect.dispatchEvent(new Event('change'));
    }

    // Init: restore settings + load division data
    Storage.get(['weatherCityName', 'weatherDisplayEnabled']).then((data) => {
      if (data.weatherCityName && currentCityEl) {
        currentCityEl.textContent = data.weatherCityName;
      }
      if (displayToggle) {
        displayToggle.checked = data.weatherDisplayEnabled !== false;
      }
    });

    if (displayToggle) {
      displayToggle.addEventListener('change', async () => {
        const enabled = displayToggle.checked;
        if (typeof weather !== 'undefined' && weather.setDisplayEnabled) {
          await weather.setDisplayEnabled(enabled);
        } else {
          await Storage.set({ weatherDisplayEnabled: enabled });
        }
      });
    }

    // Async load divisions, populate native selects, then create custom dropdowns
    let provCS, cityCS, districtCS;

    loadDivisions().then(() => {
      if (!provSelect) return;
      provSelect.innerHTML = '<option value="">省份</option>';
      for (const item of _provinceData) {
        const opt = document.createElement('option');
        opt.value = item.code;
        opt.textContent = item.name;
        provSelect.appendChild(opt);
      }
      provCS = this._createCustomSelect(provSelect);
      cityCS = this._createCustomSelect(citySelect);
      districtCS = this._createCustomSelect(districtSelect);
    });

    // Province change
    if (provSelect) {
      provSelect.addEventListener('change', async () => {
        await updateCitySelect(true);
        if (cityCS) cityCS.syncOptions();
        if (districtCS) districtCS.syncOptions();
      });
    }
    if (citySelect) {
      citySelect.addEventListener('change', () => {
        updateDistrictSelect(true);
        if (districtCS) districtCS.syncOptions();
      });
    }

    // Preview weather (without saving)
    if (previewBtn) {
      previewBtn.addEventListener('click', async () => {
        try {
          const location = _resolveWeatherLocation();
          if (!location) {
            if (locStatus) locStatus.textContent = '当前城市或区县缺少经纬度';
            _showPreviewToast('当前城市或区县缺少经纬度，请补充后再查询', true);
            return;
          }

          previewBtn.disabled = true;
          previewBtn.textContent = '查询中...';
          if (locStatus) locStatus.textContent = '获取天气数据中...';

          const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.coords.latitude}&longitude=${location.coords.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;
          const resp = await fetch(url);
          if (!resp.ok) throw new Error('API responded ' + resp.status);
          const raw = await resp.json();
          const temp = raw.current.temperature_2m;
          const humidity = raw.current.relative_humidity_2m;
          const wCode = raw.current.weather_code;
          const effect = (typeof WMO_MAP !== 'undefined' ? WMO_MAP[wCode] : null) || 'clear';
          const emoji = (typeof WEATHER_EMOJI !== 'undefined' ? WEATHER_EMOJI[effect] : null) || '🌤️';
          const desc = (typeof WEATHER_DESC !== 'undefined' ? WEATHER_DESC[effect] : null) || '';

          _showPreviewToast(`<div class="preview-temp">${emoji} ${temp}°C</div>
            <div class="preview-desc">${desc} · 湿度 ${humidity}% · 风速 ${raw.current.wind_speed_10m}km/h</div>
            <div class="preview-hint">📍 ${location.name}（未保存，点击「应用」确认）</div>`);

          if (locStatus) locStatus.textContent = `预览：${location.name} ${temp}°C ${desc}`;
        } catch (e) {
          console.error('Preview failed:', e);
          _showPreviewToast('获取天气失败，请检查网络', true);
          if (locStatus) locStatus.textContent = '获取天气失败：' + (e.message || '未知错误');
        }
        previewBtn.disabled = false;
        previewBtn.textContent = '预览';
      });
    }

    // Toast helper (shared by preview)
    function _showPreviewToast(html, isError) {
      let toast = document.getElementById('weather-preview-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'weather-preview-toast';
        document.body.appendChild(toast);
      }
      toast.className = isError ? 'visible preview-error' : 'visible';
      toast.innerHTML = isError ? `<div style="font-size:14px">${html}</div>` : html;
      clearTimeout(toast._hideTimer);
      toast._hideTimer = setTimeout(() => toast.classList.remove('visible'), 5000);
    }

    // Apply location — prefer district coordinates, then fall back to city coordinates
    if (applyBtn) {
      applyBtn.addEventListener('click', async () => {
        const location = _resolveWeatherLocation();
        if (!location) {
          if (locStatus) locStatus.textContent = '当前城市或区县缺少经纬度';
          return;
        }

        locStatus.textContent = '正在应用位置...';
        applyBtn.disabled = true;

        try {
          await weather.setCityExact(location.name, location.coords.latitude, location.coords.longitude, location.name);
          if (currentCityEl) currentCityEl.textContent = location.name;
          locStatus.textContent = '已设置为 ' + location.name;
        } catch (e) {
          console.error('Apply location failed:', e);
          locStatus.textContent = '设置失败：' + (e?.message || '未知错误');
        } finally {
          applyBtn.disabled = false;
        }
      });
    }

  },
};
