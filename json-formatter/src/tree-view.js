let expandedNodes = new Set()
const contextMenuBoundContainers = new WeakSet()

/**
 * 渲染 JSON 到树形视图
 */
export function renderTree(data) {
  const container = document.getElementById('treeContainer')
  container.innerHTML = ''
  container.appendChild(createTreeHTML(data, '$', 0))
  container.appendChild(createStats(data))
  // 恢复之前展开的状态
  expandedNodes.forEach(id => {
    const el = container.querySelector(`[data-path="${CSS.escape(id)}"]`)
    if (el) el.classList.remove('collapsed')
  })
  // 绑定折叠点击
  container.querySelectorAll('.tree-toggle').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      const node = el.closest('.tree-node')
      node.classList.toggle('collapsed')
      const path = node.dataset.path
      if (node.classList.contains('collapsed')) {
        expandedNodes.delete(path)
      } else {
        expandedNodes.add(path)
      }
    })
  })
  // 右键复制路径
  bindTreeContextMenu(container)
}

export function bindTreeContextMenu(container) {
  if (!container || contextMenuBoundContainers.has(container)) return
  contextMenuBoundContainers.add(container)
  container.addEventListener('contextmenu', handleTreeContextMenu)
}

function handleTreeContextMenu(e) {
  const entry = e.target.closest('.tree-entry')
  if (!entry) return
  e.preventDefault()
  const node = entry.closest('.tree-node')
  const path = node && node.dataset.path
  if (path) {
    navigator.clipboard.writeText(path).then(() => {
      // 轻提示：在节点旁闪烁"已复制"
      entry.style.background = 'var(--accent)'
      entry.style.color = '#fff'
      setTimeout(() => { entry.style.background = ''; entry.style.color = '' }, 300)
    }).catch(() => {})
  }
}

function createTreeHTML(data, path, depth) {
  const isArray = Array.isArray(data)
  const isObject = data !== null && typeof data === 'object' && !isArray
  const isLeaf = !isObject && !isArray
  const isCollapsed = depth > 2 && !expandedNodes.has(path)

  const wrapper = document.createElement('div')
  wrapper.className = `tree-node ${isCollapsed ? 'collapsed' : ''}`
  wrapper.dataset.path = path

  const entry = document.createElement('div')
  entry.className = 'tree-entry'

  // 折叠展开箭头（▶/▼ 由 CSS ::before 控制）
  const toggle = document.createElement('span')
  toggle.className = 'tree-toggle'
  if (!isObject && !isArray) {
    toggle.className += ' no-children'
  }
  entry.appendChild(toggle)

  if (isLeaf) {
    // 叶子节点
    const key = path.split('.').pop() || path.split('[').pop() || path
    if (key !== '$' && !path.match(/^\[\d+\]$/)) {
      const keySpan = document.createElement('span')
      keySpan.className = 'tree-key'
      keySpan.textContent = key.replace(/\.\d+$/, '') + ': '
      entry.appendChild(keySpan)
    }
    const valSpan = document.createElement('span')
    valSpan.className = `tree-${typeof data}`
    valSpan.textContent = data === null ? 'null' : JSON.stringify(data)
    entry.appendChild(valSpan)
  } else {
    // 对象/数组 -> 显示摘要
    const key = path.split('.').pop() || path
    const length = isArray ? data.length : Object.keys(data).length
    const keySpan = document.createElement('span')
    keySpan.textContent = key !== '$' ? key + ' ' : ''
    entry.appendChild(keySpan)
    const bracket = document.createElement('span')
    bracket.className = 'tree-bracket'
    bracket.textContent = isArray ? `[${length}项]` : `{${length}个属性}`
    entry.appendChild(bracket)
  }

  wrapper.appendChild(entry)

  // 子节点
  if (isObject || isArray) {
    const children = document.createElement('div')
    children.className = 'tree-children'
    if (isArray) {
      data.forEach((item, i) => {
        children.appendChild(createTreeHTML(item, `${path}[${i}]`, depth + 1))
      })
    } else {
      Object.keys(data).forEach(key => {
        const childPath = path + '.' + key
        children.appendChild(createTreeHTML(data[key], childPath, depth + 1))
      })
    }
    wrapper.appendChild(children)
  }

  return wrapper
}

function createStats(data) {
  const stats = document.createElement('div')
  stats.className = 'tree-stats'
  const counts = countNodes(data)
  stats.textContent = `\u{1F4CA} 节点: ${counts.total} | 深度: ${counts.depth} | 字符串: ${counts.string} | 数字: ${counts.number} | 布尔: ${counts.boolean} | null: ${counts.null}`
  return stats
}

function countNodes(data, depth = 0) {
  let result = { total: 1, depth, string: 0, number: 0, boolean: 0, null: 0 }
  if (data === null) { result.null = 1; return result }
  if (typeof data === 'string') { result.string = 1; return result }
  if (typeof data === 'number') { result.number = 1; return result }
  if (typeof data === 'boolean') { result.boolean = 1; return result }
  if (typeof data === 'object') {
    const items = Array.isArray(data) ? data : Object.values(data)
    for (const item of items) {
      const sub = countNodes(item, depth + 1)
      result.total += sub.total
      result.depth = Math.max(result.depth, sub.depth)
      result.string += sub.string
      result.number += sub.number
      result.boolean += sub.boolean
      result.null += sub.null
    }
  }
  return result
}

export function expandAll() {
  document.querySelectorAll('.tree-node').forEach(el => {
    el.classList.remove('collapsed')
    if (el.dataset.path) expandedNodes.add(el.dataset.path)
  })
}

export function collapseAll() {
  document.querySelectorAll('.tree-node').forEach(el => el.classList.add('collapsed'))
  expandedNodes.clear()
}

export function destroyTree() {
  const container = document.getElementById('treeContainer')
  if (container) {
    container.innerHTML = '<div class="tree-empty">输入有效 JSON 后自动显示树形结构</div>'
  }
  expandedNodes.clear()
}
