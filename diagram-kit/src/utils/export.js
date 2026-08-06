function getSvgElement() {
  return document.querySelector(
    '.preview-body .rendered-diagram svg, .preview-body svg.rendered-diagram, .preview-body .mermaid svg'
  )
}

export async function exportPng(filename = 'diagram') {
  const svg = getSvgElement()
  if (!svg) throw new Error('没有可导出的图表')
  const { toPng } = await import('html-to-image')
  const dataUrl = await toPng(svg, { backgroundColor: '#ffffff', pixelRatio: 2 })
  downloadFile(dataUrl, `${filename}.png`)
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

export async function exportPdf(filename = 'diagram') {
  const svg = getSvgElement()
  if (!svg) throw new Error('没有可导出的图表')
  const [{ toPng }, { jsPDF }] = await Promise.all([
    import('html-to-image'),
    import('jspdf')
  ])
  const pngData = await toPng(svg, { backgroundColor: '#ffffff', pixelRatio: 2 })
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [svg.clientWidth || 800, svg.clientHeight || 600]
  })
  pdf.addImage(pngData, 'PNG', 0, 0, svg.clientWidth || 800, svg.clientHeight || 600)
  pdf.save(`${filename}.pdf`)
}

function downloadFile(url, filename) {
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}
