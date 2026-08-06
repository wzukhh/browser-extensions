const bg = {
  type: 'gradient',
  color: '#1a1a2e',
  imageData: null,
  theme: 'default',

  async init() {
    const data = await Storage.get(['bgType', 'bgColor', 'bgImageData', 'theme']);
    if (data.bgType) this.type = data.bgType;
    if (data.bgColor) this.color = data.bgColor;
    if (data.bgImageData) this.imageData = data.bgImageData;
    if (data.theme) this.theme = data.theme;
    this.apply();
  },

  _getThemeConfig(themeId = this.theme) {
    const fallback = THEMES.default;
    return THEMES[themeId] || fallback;
  },

  _composeBackground(baseCss) {
    const themeCfg = this._getThemeConfig();
    const overlay = Number.isFinite(Number(themeCfg.bgOverlay)) ? Number(themeCfg.bgOverlay) : 0.22;
    const overlayCss = `linear-gradient(rgba(0,0,0,${overlay}), rgba(0,0,0,${overlay}))`;
    return `${overlayCss}, ${baseCss}`;
  },

  _getGradientIndexKey() {
    return `bgGradientIndex:${this.theme || 'default'}`;
  },

  _getNextGradientIndex(len) {
    if (!len) return 0;
    try {
      const key = this._getGradientIndexKey();
      const raw = sessionStorage.getItem(key);
      if (raw === null) {
        const start = Math.floor(Math.random() * len);
        console.log('[bg-gradient]', { theme: this.theme || 'default', key, action: 'seed', index: start, nextIndex: (start + 1) % len, len });
        sessionStorage.setItem(key, String((start + 1) % len));
        return start;
      }
      const current = Number.parseInt(raw, 10);
      const next = Number.isFinite(current) ? current % len : 0;
      console.log('[bg-gradient]', { theme: this.theme || 'default', key, action: 'advance', index: next, nextIndex: (next + 1) % len, len });
      sessionStorage.setItem(key, String((next + 1) % len));
      return next;
    } catch {
      const fallback = Math.floor(Math.random() * len);
      console.log('[bg-gradient]', { theme: this.theme || 'default', action: 'fallback-random', index: fallback, nextIndex: null, len });
      return fallback;
    }
  },

  _syncColorPicker() {
    const input = document.getElementById('color-input');
    const swatch = document.getElementById('color-swatch');
    const valueEl = document.getElementById('bg-color-value');
    if (input) input.value = this.color;
    if (swatch) swatch.style.background = this.color;
    if (valueEl) valueEl.textContent = this.color;
  },

  apply() {
    const el = document.getElementById('background');
    switch (this.type) {
      case 'gradient':
        this.applyGradient(el);
        break;
      case 'color':
        el.style.background = this._composeBackground(this.color);
        break;
      case 'unsplash':
        this.applyGradient(el);
        break;
      case 'custom':
        this.applyCustomImage(el);
        break;
    }
  },

  applyGradient(el) {
    const gradients = this._getThemeConfig().bgGradients || THEMES.default.bgGradients;
    const index = this._getNextGradientIndex(gradients.length);
    const pick = gradients[index] || THEMES.default.bgGradients[0];
    console.log('[bg-gradient-picked]', { theme: this.theme || 'default', index, pick });
    el.style.background = this._composeBackground(`linear-gradient(135deg, ${pick[0]} 0%, ${pick[1]} 50%, ${pick[2]} 100%)`);
  },

  applyCustomImage(el) {
    if (this.imageData) {
      const themeCfg = this._getThemeConfig();
      const overlay = Number.isFinite(Number(themeCfg.bgOverlay)) ? Number(themeCfg.bgOverlay) : 0.22;
      el.style.background = `linear-gradient(rgba(0,0,0,${overlay}), rgba(0,0,0,${overlay})), url(${this.imageData}) center/cover no-repeat`;
    } else {
      this.applyGradient(el);
    }
  },

  async setType(type) {
    this.type = type;
    if (type === 'color') {
      const themeCfg = this._getThemeConfig();
      this.color = themeCfg.bgColor || this.color;
      await Storage.set({ bgColor: this.color });
      this._syncColorPicker();
    }
    await Storage.set({ bgType: type });
    this.apply();
  },

  async setColor(color) {
    this.color = color;
    await Storage.set({ bgColor: color });
    this._syncColorPicker();
    this.apply();
  },

  setTheme(themeId) {
    this.theme = themeId || 'default';
    const themeCfg = this._getThemeConfig(this.theme);
    if (this.type === 'color' && themeCfg.bgColor) {
      this.color = themeCfg.bgColor;
      Storage.set({ bgColor: this.color });
      this._syncColorPicker();
    }
    this.apply();
  },

  async setImage(dataUrl) {
    this.imageData = dataUrl;
    this.type = 'custom';
    await Storage.set({ bgImageData: dataUrl, bgType: 'custom' });
    this.apply();
  },
};
