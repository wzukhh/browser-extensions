const quickLinks = {
  links: [],
  grid: document.getElementById('ql-grid'),
  ctxMenu: document.getElementById('ql-context-menu'),
  ctxIndex: -1,
  dragIndex: -1,
  dropTarget: null,
  dropIndicator: null,
  _resizeTimer: null,
  editing: false,
  selected: new Set(),
  rowSelectMode: false,
  editBtn: document.getElementById('ql-edit-btn'),
  batchBar: document.getElementById('ql-batch-bar'),
  batchCount: document.getElementById('ql-batch-count'),
  batchDeleteBtn: document.getElementById('ql-batch-delete'),
  selectAllCb: document.getElementById('ql-select-all'),
  rowSelectBtn: document.getElementById('ql-row-select-btn'),

  async init() {
    const data = await Storage.get(['quickLinks']);
    this.links = data.quickLinks || [];
    this.computeColumnCount();
    this.migrateData();
    this.render();
    this.initContextMenu();
    this.initGridDragDrop();
    this.initEditMode();
    window.addEventListener('resize', () => this.onResize());
  },

  // ---- 数据迁移：兼容旧格式（无 col/row） ----
  migrateData() {
    if (!this.links.length) return;
    const needsMigration = this.links.some(l => l.col === undefined);
    if (!needsMigration) return;
    const cols = this.getColumnCount();
    this.links = this.links.map((link, i) => ({
      ...link,
      col: i % cols,
      row: Math.floor(i / cols),
    }));
  },

  // ---- 网格列数计算 ----
  computeColumnCount() {
    const cellWidth = Math.round(78 * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ql-scale')) || 1.23));
    const gridWidth = this.grid.clientWidth;
    const layoutCols = this.links.reduce((max, link) => {
      if (typeof link.col !== 'number') return max;
      return Math.max(max, link.col + 1);
    }, 0);
    const cols = Math.max(1, Math.floor(gridWidth / cellWidth), layoutCols);
    this.grid.style.setProperty('--ql-cols', cols);
    return cols;
  },

  getColumnCount() {
    return parseInt(this.grid.style.getPropertyValue('--ql-cols')) || 6;
  },

  getCellHeight() {
    const item = this.grid.querySelector('.ql-item');
    if (item) {
      const style = getComputedStyle(this.grid);
      const gap = parseFloat(style.rowGap) || parseFloat(style.gap) || 12;
      return item.getBoundingClientRect().height + gap;
    }
    return 100;
  },

  // ---- 已占用的位置集合 ----
  occupiedPositions(excludeIndex) {
    const set = new Set();
    this.links.forEach((l, i) => {
      if (i !== excludeIndex) set.add(`${l.col},${l.row}`);
    });
    return set;
  },

  // ---- 找到第一个空格 ----
  findFirstEmpty() {
    return findFirstEmptyQuickLinkPosition(this.links, this.getColumnCount());
  },

  // ---- 统一行高 ----
  syncRowHeight() {
    const item = this.grid.querySelector('.ql-item');
    if (item) {
      this.grid.style.gridAutoRows = item.getBoundingClientRect().height + 'px';
    } else {
      this.grid.style.gridAutoRows = '';
    }
  },

  // ---- 拖拽：计算鼠标所在的网格格子 ----
  getCellAt(clientX, clientY) {
    const gridRect = this.grid.getBoundingClientRect();
    const x = clientX - gridRect.left;
    const y = clientY - gridRect.top;
    const cols = this.getColumnCount();
    const cellWidth = gridRect.width / cols;
    const cellHeight = this.getCellHeight();
    return {
      col: Math.min(cols - 1, Math.max(0, Math.floor(x / cellWidth))),
      row: Math.max(0, Math.floor(y / cellHeight)),
    };
  },

  // ---- 紧凑布局：删除后从顶部开始填满空隙 ----
  compactLayout() {
    if (!this.links.length) return;
    const cols = this.getColumnCount();
    // get visual order without reordering the array
    const order = this.links
      .map((_, i) => i)
      .sort((a, b) => {
        const va = this.links[a], vb = this.links[b];
        return va.row - vb.row || va.col - vb.col;
      });
    // reassign positions keeping array indices stable
    order.forEach((origIndex, flatIndex) => {
      this.links[origIndex].col = flatIndex % cols;
      this.links[origIndex].row = Math.floor(flatIndex / cols);
    });
  },

  // ---- 渲染（普通模式 & 编辑模式） ----
  render() {
    this.computeColumnCount();
    this.grid.innerHTML = '';

    if (!this.links.length) {
      const empty = document.createElement('div');
      empty.className = 'ql-empty';
      empty.innerHTML = '<div>点击右上角 + 添加快捷方式</div><div class="ql-empty-hint">可添加网站链接或内置模块，也可在设置中导入收藏夹</div>';
      empty.style.gridColumn = '1 / -1';
      this.grid.appendChild(empty);
      return;
    }

    const cols = this.getColumnCount();
    const isEditing = this.editing;
    this.links.forEach((link, i) => {
      const builtin = isBuiltinLink(link);
      const el = document.createElement(builtin ? 'div' : 'a');
      el.className = 'ql-item' + (builtin ? ' ql-item-builtin' : '');
      if (isEditing) el.classList.add('editing');

      const isSelected = this.selected.has(i);
      if (isSelected) el.classList.add('selected');

      if (!builtin) el.href = link.url;
      if (builtin) {
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
      }

      el.style.gridColumn = `${link.col + 1} / span 1`;
      el.style.gridRow = `${link.row + 1} / span 1`;

      const checkHtml = builtin
        ? '<span class="ql-check ql-check-disabled" title="内置模块不可批量选择"></span>'
        : `<span class="ql-check${isSelected ? ' checked' : ''}"></span>`;
      el.innerHTML = `
        ${checkHtml}
        <span class="ql-icon">${this.iconHtml(link)}</span>
        <span class="ql-name">${this.escapeHtml(link.name)}</span>
      `;

      if (isEditing) {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          if (!builtin) this.toggleSelection(i);
        });
      } else if (builtin) {
        const activate = (e) => {
          e.preventDefault();
          openBuiltinModule(link.action);
        };
        el.addEventListener('click', activate);
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openBuiltinModule(link.action);
          }
        });
      } else {
        el.addEventListener('click', async (e) => {
          e.preventDefault();
          await this.openLink(link.url);
        });
      }

      el.addEventListener('contextmenu', (e) => this.showContextMenu(e, i));

      el.draggable = !isEditing;
      if (!isEditing) {
        el.addEventListener('dragstart', (e) => this.onDragStart(e, i));
        el.addEventListener('dragend', (e) => this.onDragEnd(e));
      }

      const img = el.querySelector('.ql-icon img');
      if (img) {
        img.addEventListener('error', () => {
          img.outerHTML = `<span>${this.firstChar(link.name)}</span>`;
        });
      }

      this.grid.appendChild(el);
    });

    this.syncRowHeight();
    this.updateBatchBar();
  },

  // ---- 编辑模式 ----
  initEditMode() {
    this.editBtn.addEventListener('click', () => this.toggleEditMode());
    this.batchDeleteBtn.addEventListener('click', () => this.batchDelete());

    this.selectAllCb.addEventListener('change', () => {
      if (this.selectAllCb.checked) {
        this.links.forEach((link, i) => {
          if (!isBuiltinLink(link)) this.selected.add(i);
        });
      } else {
        this.selected.clear();
      }
      this.render();
    });

    this.rowSelectBtn.addEventListener('click', () => {
      this.rowSelectMode = !this.rowSelectMode;
      this.rowSelectBtn.classList.toggle('active', this.rowSelectMode);
    });
  },

  toggleEditMode() {
    if (this.editing) {
      this.exitEditMode();
    } else {
      this.enterEditMode();
    }
  },

  enterEditMode() {
    this.editing = true;
    this.rowSelectMode = false;
    this.rowSelectBtn.classList.remove('active');
    this.selected.clear();
    this.editBtn.textContent = '完成';
    this.editBtn.classList.add('active');
    this.batchBar.classList.remove('hidden');
    this.batchBar.style.display = '';
    this.render();
  },

  exitEditMode() {
    this.editing = false;
    this.rowSelectMode = false;
    this.rowSelectBtn.classList.remove('active');
    this.selected.clear();
    this.editBtn.textContent = '编辑';
    this.editBtn.classList.remove('active');
    this.batchBar.classList.add('hidden');
    this.batchBar.style.display = '';
    this.render();
  },

  toggleSelection(index) {
    if (isBuiltinLink(this.links[index])) return;

    if (this.rowSelectMode) {
      const targetRow = this.links[index].row;
      const rowIndices = this.links
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => l.row === targetRow && !isBuiltinLink(l))
        .map(({ i }) => i);
      const allSelected = rowIndices.every(i => this.selected.has(i));
      if (allSelected) {
        rowIndices.forEach(i => this.selected.delete(i));
      } else {
        rowIndices.forEach(i => this.selected.add(i));
      }
    } else {
      if (this.selected.has(index)) {
        this.selected.delete(index);
      } else {
        this.selected.add(index);
      }
    }
    this.render();
  },

  updateBatchBar() {
    const count = this.selected.size;
    this.batchCount.textContent = `已选 ${count} 项`;
    this.batchDeleteBtn.disabled = count === 0;

    const selectableIndices = this.links
      .map((link, i) => (isBuiltinLink(link) ? -1 : i))
      .filter(i => i >= 0);
    const selectedSelectable = [...this.selected].filter(i => !isBuiltinLink(this.links[i]));

    if (selectableIndices.length > 0) {
      this.selectAllCb.checked = selectedSelectable.length === selectableIndices.length;
      this.selectAllCb.indeterminate = selectedSelectable.length > 0
        && selectedSelectable.length < selectableIndices.length;
    } else {
      this.selectAllCb.checked = false;
      this.selectAllCb.indeterminate = false;
    }
  },

  async batchDelete() {
    const count = this.selected.size;
    if (count === 0) return;
    if (!confirm(`确定删除选中的 ${count} 个快捷链接？`)) return;

    // sort descending so splice doesn't shift indices
    const indices = [...this.selected].sort((a, b) => b - a);
    for (const i of indices) {
      this.links.splice(i, 1);
    }
    this.selected.clear();
    await this.save();
    this.render();
  },

  firstChar(str) {
    return Array.from(str || '')[0] || '?';
  },

  iconHtml(link) {
    const fallback = this.firstChar(link.name);
    if (isBuiltinLink(link)) {
      const src = getBuiltinIconUrl(link.action);
      if (src) {
        return `<img src="${this.escapeHtml(src)}" alt="" loading="lazy" />`;
      }
    }
    if (link.icon) {
      if (link.icon.startsWith('data:') || link.icon.includes('://')) {
        return `<img src="${this.escapeHtml(link.icon)}" alt="" loading="lazy" />`;
      }
      return `<span>${this.escapeHtml(link.icon)}</span>`;
    }
    return `<span>${this.escapeHtml(fallback)}</span>`;
  },

  // ---- CRUD ----
  hasBuiltin(action) {
    return this.links.some(l => isBuiltinLink(l) && l.action === action);
  },

  async addBuiltin(action) {
    const mod = getBuiltinModule(action);
    if (!mod) return false;
    if (mod.unique && this.hasBuiltin(action)) return false;
    if (this.links.length >= QUICKLINK_MAX_COUNT) return false;

    const pos = this.findFirstEmpty();
    this.links.push({
      type: 'builtin',
      action,
      name: mod.name,
      col: pos.col,
      row: pos.row,
    });
    await this.save();
    this.render();
    return true;
  },

  async add(name, url, icon) {
    const pos = this.findFirstEmpty();
    this.links.push({ name, url, icon: icon || null, col: pos.col, row: pos.row });
    await this.save();
    this.render();
  },

  async update(index, name, url, icon) {
    this.links[index] = { ...this.links[index], name, url, icon: icon || null };
    await this.save();
    this.render();
  },

  async remove(index) {
    this.links.splice(index, 1);
    await this.save();
    this.render();
  },

  // ---- 窗口缩放 ----
  onResize() {
    clearTimeout(this._resizeTimer);
    this._resizeTimer = setTimeout(() => {
      this.computeColumnCount();
      this.render();
    }, 200);
  },

  // ---- 右键菜单 ----
  initContextMenu() {
    this.ctxMenu.querySelectorAll('.ctx-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        if (this.ctxIndex < 0) return;
        if (action === 'edit') {
          modal.edit(this.ctxIndex);
        } else if (action === 'delete') {
          this.remove(this.ctxIndex);
        }
        this.hideContextMenu();
      });
    });
    document.addEventListener('click', (e) => {
      if (!this.ctxMenu.contains(e.target)) this.hideContextMenu();
    });
  },

  showContextMenu(e, index) {
    if (this.editing) return;
    e.preventDefault();
    this.ctxIndex = index;

    const builtin = isBuiltinLink(this.links[index]);
    const editBtn = this.ctxMenu.querySelector('[data-action="edit"]');
    if (editBtn) editBtn.classList.toggle('hidden', builtin);

    this.ctxMenu.style.left = e.clientX + 'px';
    this.ctxMenu.style.top = e.clientY + 'px';
    this.ctxMenu.classList.remove('hidden');
  },

  hideContextMenu() {
    this.ctxMenu.classList.add('hidden');
    this.ctxIndex = -1;
  },

  // ---- 拖拽 ----
  initGridDragDrop() {
    this.grid.addEventListener('dragover', (e) => this.onGridDragOver(e));
    this.grid.addEventListener('dragleave', (e) => this.onGridDragLeave(e));
    this.grid.addEventListener('drop', (e) => this.onGridDrop(e));
  },

  onDragStart(e, index) {
    this.dragIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    e.target.classList.add('dragging');
  },

  onDragEnd() {
    this.clearDragState();
  },

  onGridDragOver(e) {
    e.preventDefault();
    if (this.dragIndex < 0) return;
    e.dataTransfer.dropEffect = 'move';

    const target = this.getCellAt(e.clientX, e.clientY);
    const dragged = this.links[this.dragIndex];

    if (target.col === dragged.col && target.row === dragged.row) {
      if (this.dropTarget) {
        this.hideDropIndicator();
        this.dropTarget = null;
      }
      return;
    }

    const occupied = this.occupiedPositions(this.dragIndex);
    if (occupied.has(`${target.col},${target.row}`)) {
      this.hideDropIndicator();
      this.dropTarget = null;
      return;
    }

    if (!this.dropTarget || this.dropTarget.col !== target.col || this.dropTarget.row !== target.row) {
      this.dropTarget = { col: target.col, row: target.row };
      this.showDropIndicator(target.col, target.row);
    }
  },

  onGridDragLeave(e) {
    if (!this.grid.contains(e.relatedTarget)) {
      this.hideDropIndicator();
      this.dropTarget = null;
    }
  },

  onGridDrop(e) {
    e.preventDefault();
    this.hideDropIndicator();

    if (this.dragIndex < 0 || !this.dropTarget) {
      this.clearDragState();
      this.render();
      return;
    }

    const dragged = this.links[this.dragIndex];
    dragged.col = this.dropTarget.col;
    dragged.row = this.dropTarget.row;

    this.dragIndex = -1;
    this.dropTarget = null;
    this.save();
    this.render();
  },

  showDropIndicator(col, row) {
    if (!this.dropIndicator || !this.grid.contains(this.dropIndicator)) {
      this.dropIndicator = document.createElement('div');
      this.dropIndicator.className = 'ql-drop-indicator';
      this.grid.appendChild(this.dropIndicator);
    }
    this.dropIndicator.style.gridColumn = `${col + 1} / span 1`;
    this.dropIndicator.style.gridRow = `${row + 1} / span 1`;
    this.dropIndicator.style.display = '';
  },

  hideDropIndicator() {
    if (this.dropIndicator) {
      this.dropIndicator.style.display = 'none';
    }
  },

  clearDragState() {
    this.grid.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    this.hideDropIndicator();
    this.dragIndex = -1;
    this.dropTarget = null;
  },

  async save() {
    await Storage.set({ quickLinks: this.links });
  },

  getDomain(url) {
    try { return new URL(url).hostname; } catch { return ''; }
  },

  async openLink(url) {
    if (/^(chrome|edge):\/\//.test(url) && typeof chrome !== 'undefined' && chrome.tabs?.create) {
      try {
        chrome.tabs.create({ url });
        return;
      } catch {
        // fall through to window.open
      }
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
