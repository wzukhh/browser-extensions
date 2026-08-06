/** 新闻数据服务：页面级缓存 + 定时刷新 */
const newsService = {
  _cache: {},
  _enabled: true,
  _refreshTimer: null,
  _loadAllPromise: null,

  async init() {
    const data = await Storage.get(['newsEnabled']);
    this._enabled = data.newsEnabled !== false;
    if (this._enabled) this.startAutoRefresh();
    window.addEventListener('pagehide', () => this.stopAutoRefresh());
  },

  isEnabled() {
    return this._enabled;
  },

  async setEnabled(enabled) {
    this._enabled = enabled;
    await Storage.set({ newsEnabled: enabled });
    if (enabled) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
      this._cache = {};
      this._loadAllPromise = null;
      if (newsPanel.overlay) newsPanel.renderDisabled();
    }
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    this._refreshTimer = setInterval(() => this.refreshAll(true), NEWS_REFRESH_INTERVAL_MS);
  },

  stopAutoRefresh() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  },

  getCached(sourceId) {
    return this._cache[sourceId] || null;
  },

  hasLoadedAny() {
    return NEWS_SOURCE_ORDER.some(id => this._cache[id]);
  },

  async loadSource(sourceId, force = false) {
    if (!this._enabled) return null;
    if (!force && this._cache[sourceId]?.ok) return this._cache[sourceId];

    try {
      const data = await fetchNewsSource(sourceId);
      const entry = { ok: true, sourceId, ...data, fetchedAt: Date.now() };
      this._cache[sourceId] = entry;
      return entry;
    } catch (err) {
      const entry = {
        ok: false,
        sourceId,
        error: err?.message || '加载失败',
        fetchedAt: Date.now(),
      };
      this._cache[sourceId] = entry;
      return entry;
    }
  },

  async loadAll(force = false) {
    if (!this._enabled) return [];
    if (!force && this._loadAllPromise) return this._loadAllPromise;

    this._loadAllPromise = Promise.all(
      NEWS_SOURCE_ORDER.map(id => this.loadSource(id, force)),
    ).finally(() => {
      this._loadAllPromise = null;
    });

    return this._loadAllPromise;
  },

  prefetchOthers(exceptId) {
    if (!this._enabled) return;
    NEWS_SOURCE_ORDER
      .filter(id => id !== exceptId && !this._cache[id])
      .forEach(id => { this.loadSource(id, false); });
  },

  refreshOthers(exceptId) {
    if (!this._enabled) return;
    NEWS_SOURCE_ORDER
      .filter(id => id !== exceptId)
      .forEach(id => { this.loadSource(id, true); });
  },

  async refreshAll(force = true) {
    if (!this._enabled) return [];
    const results = await this.loadAll(force);
    if (newsPanel.overlay) newsPanel.onDataUpdated();
    return results;
  },

  async ensureAllLoaded(force = false) {
    if (!this._enabled) return false;
    const allReady = NEWS_SOURCE_ORDER.every(id => this._cache[id]);
    if (allReady && !force) return true;
    await this.loadAll(force);
    return true;
  },
};

/** 新闻热搜面板 */
const newsPanel = {
  overlay: null,
  activeSource: 'baidu',
  _scrollPositions: {},
  _pointerDownInside: false,
  _initialLoadDone: false,
  _scrollBound: false,

  async open() {
    if (this.overlay) return;

    this.activeSource = 'baidu';
    this._initialLoadDone = false;
    this.build();
    this.bindEvents();

    if (!newsService.isEnabled()) {
      this.renderDisabled();
      return;
    }

    if (newsService.getCached(this.activeSource)) {
      this._initialLoadDone = true;
      this.renderCurrent();
      newsService.prefetchOthers(this.activeSource);
      return;
    }

    this.renderLoading();
    const activePromise = newsService.loadSource(this.activeSource, false);
    newsService.prefetchOthers(this.activeSource);
    await activePromise;
    this._initialLoadDone = true;
    this.renderCurrent();
  },

  hide() {
    if (this.overlay) {
      this.saveScrollPosition();
      this.overlay.remove();
      this.overlay = null;
    }
    this._pointerDownInside = false;
    this._scrollBound = false;
  },

  build() {
    const tabsHtml = NEWS_SOURCE_ORDER.map(id => {
      const source = NEWS_SOURCES[id];
      return `<button type="button" class="news-tab${id === this.activeSource ? ' active' : ''}" data-source="${id}">${source.name}</button>`;
    }).join('');

    const attr = getNewsAttribution();

    this.overlay = document.createElement('div');
    this.overlay.id = 'news-modal-overlay';
    this.overlay.innerHTML = `
      <div id="news-modal">
        <div class="news-modal-header">
          <h3>新闻热搜</h3>
          <div class="news-modal-actions">
            <button type="button" id="news-refresh-btn" data-tooltip="刷新" aria-label="刷新">&#8635;</button>
            <button type="button" id="news-close-btn" aria-label="关闭">&times;</button>
          </div>
        </div>
        <div class="news-tabs" id="news-tabs">${tabsHtml}</div>
        <div class="news-modal-meta" id="news-meta"></div>
        <div class="news-modal-body" id="news-modal-body"></div>
        <div id="news-title-tip" class="news-title-tip hidden" aria-hidden="true"></div>
        <div class="news-modal-footer">
          热搜数据使用了 <a href="${attr.url}" target="_blank" rel="noopener noreferrer">${escapeNewsHtml(attr.name)}</a>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);
  },

  bindEvents() {
    this.overlay.querySelector('#news-close-btn').addEventListener('click', () => this.hide());
    this.overlay.querySelector('#news-refresh-btn').addEventListener('click', () => this.onRefresh());

    this.overlay.querySelector('#news-tabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.news-tab');
      if (!tab || tab.classList.contains('active')) return;
      this.saveScrollPosition();
      this.activeSource = tab.dataset.source;
      this.syncTabs();
      this.renderCurrent();
    });

    this.bindScrollMemory();
    this.bindTitleTooltips();

    this.overlay.querySelector('#news-modal-body').addEventListener('click', (e) => {
      const item = e.target.closest('.news-item');
      if (!item?.dataset.url) return;
      e.preventDefault();
      window.open(item.dataset.url, '_blank', 'noopener,noreferrer');
    });

    this.overlay.addEventListener('mousedown', (e) => {
      this._pointerDownInside = !!e.target.closest('#news-modal');
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

  bindTitleTooltips() {
    const body = this.getScrollBody();
    const tip = this.overlay.querySelector('#news-title-tip');
    if (!body || !tip) return;

    body.addEventListener('mouseover', (e) => {
      const el = e.target.closest('.news-title.is-truncated');
      if (!el) {
        tip.classList.add('hidden');
        tip.setAttribute('aria-hidden', 'true');
        return;
      }
      tip.textContent = el.textContent;
      tip.classList.remove('hidden');
      tip.setAttribute('aria-hidden', 'false');
      this.positionTitleTip(tip, el);
    });

    body.addEventListener('scroll', () => {
      tip.classList.add('hidden');
      tip.setAttribute('aria-hidden', 'true');
    }, { passive: true });
  },

  positionTitleTip(tip, el) {
    const rect = el.getBoundingClientRect();
    const margin = 6;
    tip.style.left = `${Math.max(8, rect.left)}px`;
    tip.style.top = `${rect.bottom + margin}px`;
    tip.style.maxWidth = `${Math.min(420, window.innerWidth - 16)}px`;
  },

  applyTruncatedTitles(body = this.getScrollBody()) {
    if (!body) return;
    body.querySelectorAll('.news-title').forEach((el) => {
      const truncated = el.scrollWidth > el.clientWidth;
      el.classList.toggle('is-truncated', truncated);
    });
  },

  syncTabs() {
    this.overlay.querySelectorAll('.news-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.source === this.activeSource);
    });
  },

  getScrollBody() {
    return this.overlay?.querySelector('#news-modal-body') || null;
  },

  saveScrollPosition(sourceId = this.activeSource) {
    const body = this.getScrollBody();
    if (!body || !sourceId) return;
    this._scrollPositions[sourceId] = body.scrollTop;
  },

  restoreScrollPosition(sourceId = this.activeSource) {
    const body = this.getScrollBody();
    if (!body || !sourceId) return;
    body.scrollTop = this._scrollPositions[sourceId] || 0;
  },

  bindScrollMemory() {
    const body = this.getScrollBody();
    if (!body || this._scrollBound) return;
    body.addEventListener('scroll', () => {
      if (this.activeSource) {
        this._scrollPositions[this.activeSource] = body.scrollTop;
      }
    }, { passive: true });
    this._scrollBound = true;
  },

  async onRefresh() {
    if (!newsService.isEnabled()) return;
    this.setRefreshLoading(true);
    this.renderLoading();
    delete this._scrollPositions[this.activeSource];

    const activePromise = newsService.loadSource(this.activeSource, true);
    newsService.refreshOthers(this.activeSource);
    await activePromise;
    this.renderCurrent();
    this.setRefreshLoading(false);
  },

  onDataUpdated() {
    if (!this.overlay || !newsService.isEnabled()) return;
    this.renderCurrent();
  },

  renderCurrent() {
    if (!this.overlay) return;
    const cached = newsService.getCached(this.activeSource);
    if (!cached) {
      this.renderLoading();
      return;
    }
    if (!cached.ok) {
      this.renderError({ message: cached.error });
      return;
    }
    this.renderList(cached);
  },

  setRefreshLoading(loading) {
    const btn = this.overlay?.querySelector('#news-refresh-btn');
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('spinning', loading);
  },

  renderDisabled() {
    const body = this.overlay.querySelector('#news-modal-body');
    const meta = this.overlay.querySelector('#news-meta');
    meta.classList.add('hidden');
    meta.textContent = '';
    this.setRefreshLoading(false);
    body.innerHTML = `
      <div class="news-state">
        <p class="news-state-title">新闻加载已关闭</p>
        <p class="news-state-desc">可在设置 → 新闻热搜 中重新开启。关闭后将不会请求任何热搜接口。</p>
      </div>
    `;
  },

  renderLoading() {
    const body = this.overlay.querySelector('#news-modal-body');
    const meta = this.overlay.querySelector('#news-meta');
    meta.classList.add('hidden');
    meta.textContent = '';
    body.innerHTML = `
      <div class="news-state news-state-loading">
        <div class="news-spinner"></div>
        <p>加载中…</p>
      </div>
    `;
  },

  renderError(err) {
    const body = this.overlay.querySelector('#news-modal-body');
    const meta = this.overlay.querySelector('#news-meta');
    meta.classList.add('hidden');
    meta.textContent = '';
    body.innerHTML = `
      <div class="news-state news-state-error">
        <p class="news-state-title">加载失败</p>
        <p class="news-state-desc">${escapeNewsHtml(err?.message || '请稍后重试')}</p>
        <button type="button" class="news-retry-btn" id="news-retry-btn">重试</button>
      </div>
    `;
    body.querySelector('#news-retry-btn')?.addEventListener('click', async () => {
      this.renderLoading();
      await newsService.loadSource(this.activeSource, true);
      this.renderCurrent();
    });
  },

  renderList(data) {
    const body = this.overlay.querySelector('#news-modal-body');
    const meta = this.overlay.querySelector('#news-meta');
    const sourceId = data.sourceId || this.activeSource;
    const savedScroll = this._scrollPositions[sourceId] || 0;

    if (data.updateTime) {
      meta.textContent = `更新于 ${data.updateTime}`;
      meta.classList.remove('hidden');
    } else {
      meta.classList.add('hidden');
      meta.textContent = '';
    }

    if (!data.items?.length) {
      body.innerHTML = `
        <div class="news-state">
          <p class="news-state-title">暂无热搜数据</p>
          <p class="news-state-desc">接口返回为空，请稍后刷新重试</p>
        </div>
      `;
      return;
    }

    body.innerHTML = `
      <ol class="news-list">
        ${data.items.map((item, i) => {
          const rank = item.rank || i + 1;
          const rankClass = rank <= 3 ? ` news-rank-${rank}` : '';
          const hot = getNewsHotText(item);
          const label = item.label ? `<span class="news-label">${escapeNewsHtml(item.label)}</span>` : '';
          const title = escapeNewsHtml(item.title);
          return `
            <li>
              <a class="news-item" href="${escapeNewsHtml(item.url)}" data-url="${escapeNewsHtml(item.url)}" target="_blank" rel="noopener noreferrer">
                <span class="news-rank${rankClass}">${rank}</span>
                <span class="news-title">${title}</span>
                <span class="news-meta-right">
                  ${label}
                  ${hot ? `<span class="news-hot">${escapeNewsHtml(hot)}</span>` : ''}
                </span>
              </a>
            </li>
          `;
        }).join('')}
      </ol>
    `;

    requestAnimationFrame(() => {
      body.scrollTop = savedScroll;
      this.applyTruncatedTitles(body);
    });
  },
};
