/** 添加快捷方式 — 第一步：类型选择器 */
const addPicker = {
  overlay: null,
  _pointerDownInside: false,

  show() {
    if (this.overlay) return;
    this.build();
    this.bindEvents();
  },

  hide() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this._pointerDownInside = false;
  },

  build() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'ql-picker-overlay';
    this.overlay.innerHTML = `
      <div id="ql-picker">
        <div class="ql-picker-header">
          <h3>添加快捷方式</h3>
          <button type="button" id="ql-picker-close" aria-label="关闭">&times;</button>
        </div>

        <div class="ql-picker-section">
          <div class="ql-picker-label">内置模块</div>
          <div class="ql-picker-grid" id="ql-picker-builtins"></div>
        </div>

        <div class="ql-picker-divider"><span>或</span></div>

        <button type="button" class="ql-picker-custom" id="ql-picker-custom">
          <span class="ql-picker-custom-icon">🔗</span>
          <span class="ql-picker-custom-text">
            <span class="ql-picker-custom-title">添加网站链接</span>
            <span class="ql-picker-custom-desc">输入网址，自动获取图标</span>
          </span>
        </button>
      </div>
    `;
    document.body.appendChild(this.overlay);
    this.renderBuiltinCards();
  },

  renderBuiltinCards() {
    const container = this.overlay.querySelector('#ql-picker-builtins');
    container.innerHTML = '';

    for (const mod of Object.values(BUILTIN_MODULES)) {
      const added = quickLinks.hasBuiltin(mod.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ql-picker-tile' + (added ? ' added' : '');
      btn.disabled = added;
      btn.dataset.action = mod.id;
      btn.title = added ? `${mod.name}（已添加）` : mod.desc;
      const iconUrl = getBuiltinIconUrl(mod.id);
      const iconMarkup = iconUrl
        ? `<img class="ql-picker-tile-img" src="${iconUrl}" alt="" />`
        : `<span class="ql-picker-tile-emoji">${mod.icon || ''}</span>`;
      btn.innerHTML = `
        ${added ? '<span class="ql-picker-tile-badge">已添加</span>' : ''}
        <span class="ql-picker-tile-icon">${iconMarkup}</span>
        <span class="ql-picker-tile-name">${mod.name}</span>
      `;
      if (!added) {
        btn.addEventListener('click', () => this.onSelectBuiltin(mod.id));
      }
      container.appendChild(btn);
    }
  },

  async onSelectBuiltin(action) {
    const ok = await quickLinks.addBuiltin(action);
    if (ok) this.hide();
  },

  bindEvents() {
    this.overlay.querySelector('#ql-picker-close').addEventListener('click', () => this.hide());
    this.overlay.querySelector('#ql-picker-custom').addEventListener('click', () => {
      this.hide();
      modal.show();
    });

    this.overlay.addEventListener('mousedown', (e) => {
      this._pointerDownInside = !!e.target.closest('#ql-picker');
    });
    this.overlay.addEventListener('click', (e) => {
      if (e.target !== this.overlay) return;
      if (this._pointerDownInside) {
        this._pointerDownInside = false;
        return;
      }
      if (window.getSelection && window.getSelection().toString()) return;
      this.hide();
    });
  },
};
