const search = {
  input: document.getElementById('search-input'),
  switcher: document.getElementById('se-switcher'),
  icon: document.getElementById('se-current-icon'),
  iconText: document.getElementById('se-current-text'),
  dropdown: document.getElementById('se-dropdown'),
  engine: 'google',
  customEngines: [],
  hiddenEngines: [],

  async init() {
    const data = await Storage.get(['searchEngine', 'customEngines', 'hiddenEngines']);
    if (data.customEngines) this.customEngines = data.customEngines;
    if (data.hiddenEngines) this.hiddenEngines = data.hiddenEngines;
    if (data.searchEngine) this.engine = data.searchEngine;
    this.buildDropdown();
    this.updateSwitcher();

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.execute();
    });

    this.switcher.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown();
    });

    document.addEventListener('click', () => this.closeDropdown());

    this.icon.addEventListener('error', () => {
      this.icon.style.display = 'none';
      this.iconText.style.display = 'inline';
    });
  },

  getEngine(id) {
    const engine = this.customEngines.find(e => e.id === id) || BUILTIN_ENGINES[id];
    if (engine && !engine.icon && engine.url) {
      engine.icon = getFaviconUrl(engine.url);
    }
    return engine;
  },

  getAllEngines() {
    const builtin = Object.values(BUILTIN_ENGINES).filter(e => !this.hiddenEngines.includes(e.id));
    return [...builtin, ...this.customEngines];
  },

  get count() {
    return this.getAllEngines().length;
  },

  buildDropdown() {
    this.dropdown.innerHTML = '';
    const all = this.getAllEngines();
    all.forEach(engine => {
      this.getEngine(engine.id); // 预加载图标

      const btn = document.createElement('button');
      btn.className = 'se-option';
      btn.dataset.engine = engine.id;

      if (engine.icon) {
        const img = document.createElement('img');
        img.src = engine.icon;
        img.alt = '';
        img.loading = 'lazy';
        img.addEventListener('error', () => {
          const span = document.createElement('span');
          span.className = 'se-fallback';
          span.textContent = Array.from(engine.name)[0] || '?';
          img.replaceWith(span);
        });
        btn.appendChild(img);
      } else {
        const span = document.createElement('span');
        span.className = 'se-fallback';
        span.textContent = Array.from(engine.name)[0] || '?';
        btn.appendChild(span);
      }

      btn.appendChild(document.createTextNode(' ' + engine.name));

      btn.addEventListener('click', () => {
        this.setEngine(engine.id);
        this.closeDropdown();
        this.input.focus();
      });

      this.dropdown.appendChild(btn);
    });
  },

  toggleDropdown() {
    this.dropdown.classList.toggle('hidden');
  },

  closeDropdown() {
    this.dropdown.classList.add('hidden');
  },

  execute() {
    const query = this.input.value.trim();
    if (!query) return;
    if (this.isUrl(query)) {
      if (/^https?:\/\//.test(query) || /^(chrome|edge):\/\//.test(query)) {
        window.open(query, '_blank');
      } else {
        window.open('https://' + query, '_blank');
      }
      this.input.value = '';
      return;
    }
    const engine = this.getEngine(this.engine);
    if (engine) {
      window.open(engine.url + encodeURIComponent(query), '_blank');
      this.input.value = '';
    }
  },

  isUrl(str) {
    return /^https?:\/\//.test(str) || /^(chrome|edge):\/\//.test(str) || /^[\w-]+(\.[\w-]+)+/.test(str);
  },

  async setEngine(key) {
    this.engine = key;
    await Storage.set({ searchEngine: key });
    this.updateSwitcher();
    if (settings && settings.renderEngineList) {
      settings.renderEngineList(key);
    }
  },

  updateSwitcher() {
    const engine = this.getEngine(this.engine);
    this.iconText.textContent = engine ? Array.from(engine.name)[0] : '?';
    if (engine && engine.icon) {
      this.icon.src = engine.icon;
      this.icon.style.display = '';
      this.iconText.style.display = 'none';
    } else {
      this.icon.style.display = 'none';
      this.iconText.style.display = 'inline';
    }
  },

  async deleteEngine(id) {
    if (this.count <= 1) return;

    if (BUILTIN_ENGINES[id]) {
      this.hiddenEngines.push(id);
    } else {
      this.customEngines = this.customEngines.filter(e => e.id !== id);
    }

    if (this.engine === id) {
      const all = this.getAllEngines();
      if (all.length > 0) {
        this.engine = all[0].id;
        await Storage.set({ searchEngine: this.engine });
      }
    }

    await Storage.set({ customEngines: this.customEngines, hiddenEngines: this.hiddenEngines });
    this.buildDropdown();
    this.updateSwitcher();
  },
};
