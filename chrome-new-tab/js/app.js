const MAX_ICON_SIZE = 500 * 1024; // 500KB

const modal = {
  overlay: null,
  nameInput: null,
  urlInput: null,
  iconDisplay: null,
  iconUrlInput: null,
  iconStatus: null,
  iconUpload: null,
  iconData: null, // data URL or http URL
  faviconCache: {}, // domain → favicon URL string | null
  _iconClearedByUser: false,
  editIndex: -1,
  _pointerDownInsideModal: false,

  show(index) {
    if (this.overlay) return;
    if (index >= 0 && isBuiltinLink(quickLinks.links[index])) return;
    this.editIndex = index ?? -1;
    this.iconData = null;
    this._iconClearedByUser = false;
    this.build();
    this.bindEvents();
    if (this.editIndex >= 0) this.populate();
    setTimeout(() => this.nameInput.focus(), 100);
  },

  edit(index) {
    this.show(index);
  },

  build() {
    const isEdit = this.editIndex >= 0;
    this.overlay = document.createElement('div');
    this.overlay.id = 'ql-modal-overlay';
    this.overlay.innerHTML = `
      <div id="ql-modal">
        <h3>${isEdit ? '编辑' : '添加'}网站链接</h3>

        <label>名称</label>
        <input type="text" id="ql-modal-name" placeholder="例如: GitHub" />

        <label>网址</label>
        <input type="text" id="ql-modal-url" placeholder="https://github.com" />

        <label>图标</label>
        <div id="ql-icon-section">
          <div id="ql-icon-preview">
            <div class="ql-icon-box" id="ql-icon-box">?</div>
            <div class="ql-icon-spinner hidden" id="ql-icon-spinner"></div>
          </div>
          <div class="ql-icon-right">
            <input type="text" id="ql-icon-url" placeholder="图标 URL（自动或手动填写）" />
            <div class="ql-icon-actions">
              <span class="ql-icon-status" id="ql-icon-status"></span>
              <button id="ql-icon-refetch" class="ql-icon-refetch-btn" style="display:none">重新获取</button>
              <label class="ql-icon-upload-btn" id="ql-icon-upload-label">
                上传图片
                <input type="file" id="ql-icon-file" accept="image/*" hidden />
              </label>
            </div>
          </div>
        </div>

        <div class="ql-modal-actions">
          <button id="ql-modal-cancel">取消</button>
          <button id="ql-modal-save">${isEdit ? '保存' : '添加'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.nameInput = this.overlay.querySelector('#ql-modal-name');
    this.urlInput = this.overlay.querySelector('#ql-modal-url');
    this.iconDisplay = this.overlay.querySelector('#ql-icon-box');
    this.iconSpinner = this.overlay.querySelector('#ql-icon-spinner');
    this.iconUrlInput = this.overlay.querySelector('#ql-icon-url');
    this.iconStatus = this.overlay.querySelector('#ql-icon-status');
    this.iconUpload = this.overlay.querySelector('#ql-icon-file');
    this.iconRefetch = this.overlay.querySelector('#ql-icon-refetch');
  },

  bindEvents() {
    this.overlay.querySelector('#ql-modal-cancel').addEventListener('click', () => this.hide());
    this.overlay.querySelector('#ql-modal-save').addEventListener('click', () => this.save());
    this.overlay.addEventListener('mousedown', (e) => {
      this._pointerDownInsideModal = !!e.target.closest('#ql-modal');
    });
    this.overlay.addEventListener('click', (e) => {
      if (e.target !== this.overlay) return;
      if (this._pointerDownInsideModal) {
        this._pointerDownInsideModal = false;
        return;
      }
      if (window.getSelection && window.getSelection().toString()) return;
      this.hide();
    });
    this.urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.iconData) this.autoFetchFavicon();
      if (e.key === 'Enter' && this.iconData) this.save();
    });
    // Auto-fetch on blur — only if user has focused the input
    this.urlInput.addEventListener('focus', () => {
      this.urlInput.dataset.visited = 'true';
    });
    this.urlInput.addEventListener('blur', () => {
      if (this.urlInput.dataset.visited) this.autoFetchFavicon();
    });
    // Manual icon URL input
    this.iconUrlInput.addEventListener('input', () => this.previewIconUrl());
    // File upload
    this.iconUpload.addEventListener('change', (e) => this.handleFileUpload(e));
    // Re-fetch favicon
    this.iconRefetch.addEventListener('click', () => {
      this.iconData = null;
      this.iconUrlInput.value = '';
      this.iconDisplay.innerHTML = '?';
      this.iconDisplay.classList.remove('has-icon');
      this.setIconStatus('', '');
      this.autoFetchFavicon();
    });
  },

  populate() {
    const link = quickLinks.links[this.editIndex];
    this.nameInput.value = link.name;
    this.urlInput.value = link.url;
    this.iconRefetch.style.display = '';
    if (link.icon) {
      this.iconData = link.icon;
      this.showPreview(link.icon);
      this.iconUrlInput.value = link.icon.startsWith('data:') ? '(base64)' : link.icon;
    }
  },

  async autoFetchFavicon() {
    const url = this.urlInput.value.trim();
    if (!url) return;
    if (/^(chrome|edge):\/\//.test(url)) {
      const emoji = getInternalPageIcon(url);
      if (emoji) {
        this.iconDisplay.textContent = emoji;
        this.iconDisplay.classList.add('has-icon');
        this.iconData = emoji;
        this.setIconStatus('success', '✓ 内置页面图标');
        return;
      }
    }
    let normalized = url;
    if (!/^https?:\/\//.test(normalized)) normalized = 'https://' + normalized;
    let domain;
    try { domain = new URL(normalized).hostname; } catch { return; }

    // Load cache on first use
    if (Object.keys(this.faviconCache).length === 0) {
      const data = await Storage.get(['faviconCache']);
      this.faviconCache = data.faviconCache || {};
    }

    // Check cache — skip re-fetch if already attempted
    if (domain in this.faviconCache) {
      const cached = this.faviconCache[domain];
      if (cached) {
        // 旧缓存可能存了 xinac 默认图标，重新验证
        if (cached.startsWith('https://api.xinac.net/icon/')) {
          delete this.faviconCache[domain];
          await Storage.set({ faviconCache: this.faviconCache });
        } else {
          this.iconData = cached;
          this.showPreview(cached);
          this.iconUrlInput.value = cached;
          this.setIconStatus('success', '✓ 图标已缓存');
          return;
        }
      } else {
        this.iconData = null;
        this.iconUrlInput.value = '';
        this.setIconStatus('error', '获取图标失败，请手动设置');
        return;
      }
    }

    // 1. Try xinac API (third-party favicon service)
    this.setIconStatus('loading', '获取中...');
    const xinacUrl = `https://api.xinac.net/icon/?url=${domain}`;
    let xinacOk = false;
    let xinacFoundDefault = false;
    try {
      const resp = await fetch(xinacUrl);
      if (resp.ok) {
        const blob = await resp.blob();
        if (await isXinacDefaultIcon(blob)) {
          xinacFoundDefault = true;
        } else {
          xinacOk = await this.testImageLoad(xinacUrl, 3000);
        }
      }
    } catch {
      xinacOk = await this.testImageLoad(xinacUrl, 3000);
    }
    if (xinacOk) {
      this.iconData = xinacUrl;
      this.cacheAndDone(domain, xinacUrl);
      return;
    }
    // xinac 确认是默认图标 → 该域名无 favicon，跳过后续所有 fallback
    if (xinacFoundDefault) {
      this.iconData = null;
      this.faviconCache[domain] = null;
      await Storage.set({ faviconCache: this.faviconCache });
      this.iconUrlInput.value = '';
      this.setIconStatus('error', '获取图标失败，请手动设置');
      return;
    }

    // 2. Try Chrome favicon cache (also works for intranet sites)
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      const chromeFavUrl = chrome.runtime.getURL('_favicon/?pageUrl=' + encodeURIComponent(normalized) + '&size=64');
      const chromeOk = await this.testImageLoad(chromeFavUrl, 3000);
      if (chromeOk) {
        this.iconData = chromeFavUrl;
        this.cacheAndDone(domain, chromeFavUrl);
        return;
      }
    }

    // 3. Try loading favicon.ico via Image (no CORS needed for img elements)
    const favUrl = `https://${domain}/favicon.ico`;
    const ok = await this.testImageLoad(favUrl, 5000);
    if (ok) {
      this.iconData = favUrl;
      this.cacheAndDone(domain, favUrl);
      return;
    }

    // 4. Fetch webpage HTML, parse <link rel="icon"> (需要 host_permissions 绕过 CORS)
    const htmlIcon = await this.fetchIconFromHtml(normalized);
    if (htmlIcon) {
      const loaded = await this.testImageLoad(htmlIcon, 5000);
      if (loaded) {
        this.iconData = htmlIcon;
        this.cacheAndDone(domain, htmlIcon);
        return;
      }
    }

    // 3. All failed
    this.iconData = null;
    this.faviconCache[domain] = null;
    await Storage.set({ faviconCache: this.faviconCache });
    this.iconUrlInput.value = '';
    this.setIconStatus('error', '获取图标失败，请手动设置');
  },

  async fetchIconFromHtml(pageUrl) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const resp = await fetch(pageUrl, { signal: ctrl.signal });
      clearTimeout(t);
      if (!resp.ok) return null;
      const html = await resp.text();

      // Match <link rel="icon" href="..."> / <link rel="shortcut icon" href="...">
      const m = html.match(/<link[^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*href=["']([^"']+)["']/i);
      if (!m) return null;

      return new URL(m[1], pageUrl).href;
    } catch {
      return null;
    }
  },

  cacheAndDone(domain, url) {
    this.faviconCache[domain] = url;
    Storage.set({ faviconCache: this.faviconCache });
    this.showPreview(url);
    this.iconUrlInput.value = url;
    this.setIconStatus('success', '✓ 图标已获取');
  },

  testImageLoad(src, timeoutMs) {
    return Promise.race([
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = src;
      }),
      new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ]);
  },

  previewIconUrl() {
    const val = this.iconUrlInput.value.trim();
    if (!val) {
      this.iconData = null;
      this._iconClearedByUser = true;
      this.iconDisplay.innerHTML = '?';
      this.iconDisplay.classList.remove('has-icon');
      this.setIconStatus('', '');
      return;
    }
    this._iconClearedByUser = false;
    if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:')) {
      this.iconData = val;
      this.showPreview(val);
      this.setIconStatus('success', '✓ 手动设置');
    }
  },

  handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_ICON_SIZE) {
      this.setIconStatus('error', `✗ 图片过大（超过 ${(MAX_ICON_SIZE / 1024).toFixed(0)}KB）`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.iconData = reader.result;
      this.showPreview(this.iconData);
      this.iconUrlInput.value = '(base64)';
      this.setIconStatus('success', '✓ 已上传');
    };
    reader.readAsDataURL(file);
  },

  showPreview(dataUrl) {
    if (dataUrl && !dataUrl.includes('://') && !dataUrl.startsWith('data:')) {
      this.iconDisplay.textContent = dataUrl;
    } else {
      this.iconDisplay.innerHTML = `<img src="${dataUrl}" alt="" />`;
    }
    this.iconDisplay.classList.add('has-icon');
    this.iconSpinner.classList.add('hidden');
  },

  setIconStatus(type, msg) {
    if (type === 'loading') {
      this.iconSpinner.classList.remove('hidden');
      this.iconStatus.textContent = msg;
      this.iconStatus.className = 'ql-icon-status loading';
    } else {
      this.iconSpinner.classList.add('hidden');
      this.iconStatus.textContent = msg;
      this.iconStatus.className = 'ql-icon-status ' + type;
    }
  },

  hide() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.editIndex = -1;
    this.iconData = null;
    this._pointerDownInsideModal = false;
  },

  async save() {
    const name = this.nameInput.value.trim();
    let url = this.urlInput.value.trim();
    if (!name || !url) return;
    if (!/^https?:\/\//.test(url) && !/^(chrome|edge):\/\//.test(url)) url = 'https://' + url;

    // 用户手动清空图标输入 → 使用标题首字符
    const cleared = this._iconClearedByUser || (this.editIndex >= 0 && !this.iconUrlInput.value.trim());

    // Try auto-fetch if user clicked save without blur
    if (!cleared && !this.iconData) {
      await this.autoFetchFavicon();
    }

    if (this.editIndex >= 0) {
      await quickLinks.update(this.editIndex, name, url, cleared ? null : (this.iconData || undefined));
    } else {
      await quickLinks.add(name, url, this.iconData || undefined);
    }
    this.hide();
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  await runVersionMigration();

  clock.init();
  search.init();
  await bg.init();
  await quickLinks.init();
  await newsService.init();
  settings.init();
  weather.init();

  document.getElementById('ql-add-btn').addEventListener('click', () => addPicker.show());
});

const MIGRATION_KEY = '_migratedVersion';
const BACKUP_KEY = '_configBackup';

async function runVersionMigration() {
  const data = await Storage.get([MIGRATION_KEY, BACKUP_KEY, 'quickLinks', 'searchEngine']);

  // Auto-restore: config is missing/empty but a backup exists
  const configMissing = (!data.quickLinks || data.quickLinks.length === 0) && !data.searchEngine;
  if (configMissing && data[BACKUP_KEY]) {
    const { data: configData } = data[BACKUP_KEY];
    await Storage.remove(CONFIG_CLEAR_KEYS);
    await Storage.set(configData);
    await Storage.set({ [MIGRATION_KEY]: APP_VERSION });
    return;
  }

  // Version changed — save backup of current config before upgrade
  if (data[MIGRATION_KEY] && data[MIGRATION_KEY] !== APP_VERSION) {
    const config = exportConfigData(await Storage.get(CONFIG_KEYS));
    await Storage.set({
      [BACKUP_KEY]: {
        version: data[MIGRATION_KEY],
        data: config,
        backedUpAt: Date.now(),
      },
      [MIGRATION_KEY]: APP_VERSION,
    });
  } else if (!data[MIGRATION_KEY]) {
    // Fresh install (no version recorded yet)
    await Storage.set({ [MIGRATION_KEY]: APP_VERSION });
  }
}
