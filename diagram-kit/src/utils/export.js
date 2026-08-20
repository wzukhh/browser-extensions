function getSvgElement() {
  return document.querySelector(
    '.preview-body .rendered-diagram svg, .preview-body svg.rendered-diagram, .preview-body .mermaid svg'
  )
}

// 导出按图表的内在尺寸栅格化（而非显示尺寸），内容多时放大依然清晰。
// 显示尺寸会把大图缩进视口，按显示尺寸 ×2 导出时每个内容像素分不到 2 个输出像素。
const EXPORT_SCALE = 2

function isMarkmap(svg) {
  return svg.classList.contains('markmap')
}

// 内在尺寸：mermaid 用 viewBox；markmap 的 svg 没有 viewBox，
// 且 fit 缩放是作用在顶层 <g> 的 transform 上，尺寸取 <g> 的 bbox
function getIntrinsicSize(svg) {
  if (isMarkmap(svg)) {
    const g = svg.querySelector('g')
    if (!g) throw new Error('没有可导出的图表内容')
    const b = g.getBBox()
    if (!b.width || !b.height) throw new Error('图表尺寸异常')
    return { width: b.width, height: b.height, dx: -b.x, dy: -b.y }
  }
  const vb = svg.viewBox && svg.viewBox.baseVal
  if (vb && vb.width && vb.height) {
    return { width: vb.width, height: vb.height, dx: 0, dy: 0 }
  }
  const w = parseFloat(svg.getAttribute('width'))
  const h = parseFloat(svg.getAttribute('height'))
  if (w && h) return { width: w, height: h, dx: 0, dy: 0 }
  throw new Error('无法确定图表尺寸')
}

let exportHost = null
function getExportHost() {
  if (!exportHost) {
    exportHost = document.createElement('div')
    exportHost.style.cssText = 'position:fixed;left:-20000px;top:0;'
    document.body.appendChild(exportHost)
  }
  return exportHost
}

// 克隆一份 SVG 用于导出：强制为内在尺寸、去掉 markmap 的缩放 transform，
// 不干扰页面上正在交互的原图
function cloneForExport(svg, size) {
  const clone = svg.cloneNode(true)
  if (size.dx || size.dy) {
    const g = clone.querySelector('g')
    if (g) g.setAttribute('transform', `translate(${size.dx},${size.dy})`)
  }
  clone.style.cssText = `width:${size.width}px;height:${size.height}px;max-width:none;background:#fff`
  getExportHost().appendChild(clone)
  return clone
}

export async function exportPng(filename = 'diagram') {
  const svg = getSvgElement()
  if (!svg) throw new Error('没有可导出的图表')
  const { toCanvas } = await import('html-to-image')
  const size = getIntrinsicSize(svg)
  const clone = cloneForExport(svg, size)
  const canvas = await toCanvas(clone, {
    backgroundColor: '#ffffff',
    width: size.width,
    height: size.height,
    canvasWidth: Math.round(size.width * EXPORT_SCALE),
    canvasHeight: Math.round(size.height * EXPORT_SCALE),
    pixelRatio: 1,
    fontEmbedCSS: ''
  })
  downloadFile(canvas.toDataURL('image/png'), `${filename}.png`)
}

export async function exportSvg(filename = 'diagram') {
  const svg = getSvgElement()
  if (!svg) throw new Error('没有可导出的图表')
  const svgStr = new XMLSerializer().serializeToString(svg)
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  downloadFile(url, `${filename}.svg`)
  URL.revokeObjectURL(url)
}

function downloadFile(url, filename) {
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}
