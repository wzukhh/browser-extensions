<template>
  <div class="preview-panel">
    <div class="preview-header">
      <span class="preview-title">预览</span>
      <span v-if="errorMsg" class="preview-error-badge">错误</span>
      <div class="preview-controls" v-if="!errorMsg">
        <div class="theme-group">
          <button v-for="t in diagramThemes" :key="t.id"
            class="theme-dot-btn"
            :class="{ active: diagramTheme === t.id }"
            :style="{ background: t.color }"
            @click="switchTheme(t.id)"
            :data-tip="t.name">
          </button>
        </div>
        <button class="preview-btn" @click="fitToWidth">自适应</button>
        <button class="preview-btn" @click="fullscreen = true">⛶ 全屏</button>
      </div>
    </div>
    <div class="preview-body" ref="bodyRef" :class="{ 'fit-mode': isFitMode, 'dragging': isDragging }" @dblclick="fullscreen = true">
      <div class="mermaid-wrap" ref="wrapRef" @wheel.prevent="onWheel"
        @mousedown.prevent="onDragStart">
        <div v-if="errorMsg" class="preview-error">
          <div class="error-icon">⚠</div>
          <div class="error-title">渲染错误</div>
          <pre class="error-msg">{{ errorMsg }}</pre>
        </div>
        <div class="mermaid rendered-diagram" v-show="svgContent" v-html="svgContent"></div>
        <div v-if="!svgContent && !errorMsg" class="preview-empty">输入 Mermaid 语法开始预览</div>
      </div>
    </div>

    <Teleport to="body">
      <div class="fullscreen-overlay" v-if="fullscreen" @click.self="fullscreen = false" @wheel.prevent>
        <div class="fullscreen-content">
          <button class="fullscreen-close" @click="fullscreen = false">✕</button>
          <div class="fullscreen-body" @dblclick="fullscreen = false">
            <div class="mermaid" v-html="svgContent"></div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import mermaid from 'mermaid'
import { get, set, KEYS } from '../utils/storage.js'
import { getWheelPanDelta, getWheelZoomFactor, isPinchGesture } from '../utils/previewGestures.js'
import { capturePreviewViewState, restorePreviewViewState } from '../utils/previewViewState.js'
const props = defineProps({ content: { type: String, default: '' } })
const emit = defineEmits(['svgReady'])
const bodyRef = ref(null)
const wrapRef = ref(null)
const errorMsg = ref('')
const fullscreen = ref(false)
const svgContent = ref('')
const isFitMode = ref(true)
const isDragging = ref(false)
const diagramTheme = ref('default')

const themeConfigs = {
  default: { theme: 'default', themeVariables: {} },
  clear: {
    theme: 'base',
    themeVariables: {
      primaryColor: '#dbeafe', primaryTextColor: '#1e3a5f', primaryBorderColor: '#60a5fa',
      lineColor: '#475569', secondaryColor: '#fef3c7', tertiaryColor: '#e0e7ff',
      background: '#ffffff', clusterBkg: '#f8fafc', clusterBorder: '#cbd5e1',
      titleColor: '#1e293b', edgeLabelBackground: '#ffffff',
      nodeBorder: '#60a5fa', nodeTextColor: '#1e3a5f'
    }
  },
  warmtea: {
    theme: 'base',
    themeVariables: {
      primaryColor: '#fed7aa', primaryTextColor: '#3d2e1e', primaryBorderColor: '#d9775b',
      lineColor: '#a3927c', secondaryColor: '#fde68a', tertiaryColor: '#d1fae5',
      background: '#fef7ed', clusterBkg: '#fffbeb', clusterBorder: '#e6d5c3',
      titleColor: '#3d2e1e', edgeLabelBackground: '#fffbeb',
      nodeBorder: '#d9775b', nodeTextColor: '#3d2e1e'
    }
  },
  mint: {
    theme: 'base',
    themeVariables: {
      primaryColor: '#ccfbf1', primaryTextColor: '#0f172a', primaryBorderColor: '#14b8a6',
      lineColor: '#94a3b8', secondaryColor: '#fce7f3', tertiaryColor: '#ede9fe',
      background: '#f0fdfa', clusterBkg: '#f0fdfa', clusterBorder: '#99f6e4',
      titleColor: '#0f172a', edgeLabelBackground: '#f0fdfa',
      nodeBorder: '#14b8a6', nodeTextColor: '#0f172a'
    }
  }
}

const diagramThemes = [
  { id: 'default', name: '默认', color: '#58a6ff' },
  { id: 'clear', name: '清澈', color: '#60a5fa' },
  { id: 'warmtea', name: '暖茶', color: '#d9775b' },
  { id: 'mint', name: '薄荷', color: '#14b8a6' }
]
let naturalW = 800
let naturalH = 600
let renderId = 0
let dragStartX = 0
let dragStartY = 0
let dragOffsetX = 0
let dragOffsetY = 0
let renderTimer = null
let suppressNextAutoFit = false

const ZOOM_MIN = 0.25
const ZOOM_MAX = 4

function initMermaid(id) {
  const cfg = themeConfigs[id || diagramTheme.value]
  mermaid.initialize({
    startOnLoad: false,
    theme: cfg.theme,
    themeVariables: cfg.themeVariables,
    securityLevel: 'strict',
    fontFamily: 'sans-serif'
  })
}

async function switchTheme(id) {
  diagramTheme.value = id
  initMermaid(id)
  renderDiagram({ preserveView: true })
  // Persist
  const settings = (await get(KEYS.SETTINGS)) || {}
  settings.mermaidTheme = id
  await set(KEYS.SETTINGS, settings)
}

;(async () => {
  const settings = (await get(KEYS.SETTINGS)) || {}
  if (settings.mermaidTheme && themeConfigs[settings.mermaidTheme]) {
    diagramTheme.value = settings.mermaidTheme
  }
  initMermaid()
})()

watch(() => props.content, () => {
  clearTimeout(renderTimer)
  renderTimer = setTimeout(() => renderDiagram(), 300)
}, { immediate: true })

// Auto-fit when new SVG renders
watch(svgContent, (val) => {
  if (!val) return
  if (suppressNextAutoFit) {
    suppressNextAutoFit = false
    return
  }
  if (isFitMode.value) nextTick(() => { autoFit() })
})

function getSvgSize(svgStr) {
  const wm = svgStr.match(/width="(\d+)"/)
  const hm = svgStr.match(/height="(\d+)"/)
  const vm = svgStr.match(/viewBox="([^"]+)"/)
  if (vm) {
    const p = vm[1].split(/\s+/).map(Number)
    return { w: p[2] || (wm ? +wm[1] : 800), h: p[3] || (hm ? +hm[1] : 600) }
  }
  return { w: wm ? +wm[1] : 800, h: hm ? +hm[1] : 600 }
}

function getSvg() {
  return wrapRef.value?.querySelector('.mermaid svg')
}

function autoFit() {
  const svg = getSvg()
  if (!svg || !bodyRef.value) return
  resetDrag(svg)
  const cw = bodyRef.value.clientWidth - 20
  const ch = bodyRef.value.clientHeight - 20
  const scale = Math.min(cw / naturalW, ch / naturalH, 1)
  svg.style.width = Math.round(naturalW * scale) + 'px'
  svg.style.height = 'auto'
}

function onWheel(e) {
  const svg = getSvg()
  if (!svg) return
  isFitMode.value = false

  if (isPinchGesture(e)) {
    zoomWithWheel(e, svg)
    return
  }

  panWithWheel(e, svg)
}

function zoomWithWheel(e, svg) {
  const curPx = parseInt(svg.style.width) || bodyRef.value?.clientWidth || naturalW
  const factor = getWheelZoomFactor(e)
  const raw = Math.round(curPx * factor)
  const clamped = Math.round(Math.min(ZOOM_MAX * naturalW, Math.max(ZOOM_MIN * naturalW, raw)))
  svg.style.width = clamped + 'px'
  svg.style.height = 'auto'
}

function panWithWheel(e, svg) {
  const delta = getWheelPanDelta(e)
  dragOffsetX += delta.x
  dragOffsetY += delta.y
  applyDragTransform(svg)
}

function fitToWidth() {
  isFitMode.value = true
  nextTick(() => autoFit())
}

function resetDrag(svg) {
  if (svg) svg.style.transform = ''
  dragOffsetX = 0; dragOffsetY = 0
}

function onDragStart(e) {
  if (isFitMode.value) return
  const svg = getSvg()
  if (!svg) return
  isDragging.value = true
  dragStartX = e.clientX - dragOffsetX
  dragStartY = e.clientY - dragOffsetY
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e) {
  dragOffsetX = e.clientX - dragStartX
  dragOffsetY = e.clientY - dragStartY
  const svg = getSvg()
  if (svg) applyDragTransform(svg)
}

function applyDragTransform(svg) {
  svg.style.transform = 'translate(' + dragOffsetX + 'px,' + dragOffsetY + 'px)'
}

function onDragEnd() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

async function renderDiagram(options = {}) {
  const content = props.content?.trim()
  if (!content) { errorMsg.value = ''; svgContent.value = ''; return }
  const preservedView = options.preserveView
    ? capturePreviewViewState(getSvg(), { offsetX: dragOffsetX, offsetY: dragOffsetY })
    : null

  renderId++
  const currentId = renderId
  try {
    const { svg } = await mermaid.render('mermaid-' + Date.now(), content)
    if (currentId !== renderId) return
    if (preservedView) suppressNextAutoFit = true
    svgContent.value = svg
    const sz = getSvgSize(svg)
    naturalW = sz.w; naturalH = sz.h
    if (preservedView) {
      nextTick(() => {
        const nextSvg = getSvg()
        restorePreviewViewState(nextSvg, preservedView)
        dragOffsetX = preservedView.offsetX
        dragOffsetY = preservedView.offsetY
      })
    }
    errorMsg.value = ''
    emit('svgReady', svg)
  } catch (err) {
    if (currentId !== renderId) return
    errorMsg.value = err.message || String(err)
    svgContent.value = ''
  }
}

onBeforeUnmount(() => {
  clearTimeout(renderTimer)
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
})
</script>

<style scoped>
.preview-panel { display: flex; flex-direction: column; height: 100%; background: var(--bg-primary); }
.preview-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 12px; border-bottom: 1px solid var(--border-color);
  background: var(--toolbar-bg); font-size: 12px; color: var(--text-secondary); height: 32px;
}
.preview-title { font-weight: 600; }
.preview-error-badge { color: var(--accent-danger); font-weight: 600; }
.preview-controls { display: flex; align-items: center; gap: 4px; }
.preview-btn {
  background: var(--bg-tertiary); border: 1px solid var(--border-color);
  color: var(--text-primary); padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;
}
.preview-btn:hover { background: var(--bg-hover); }
.preview-zoom { min-width: 40px; text-align: center; font-family: var(--code-font); }

.theme-group { display: flex; align-items: center; gap: 3px; margin-right: 4px; padding-right: 6px; border-right: 1px solid var(--border-color); }
.theme-dot-btn {
  width: 16px; height: 16px; border-radius: 50%; border: 2px solid transparent;
  cursor: pointer; padding: 0; transition: border-color 0.12s;
}
.theme-dot-btn.active { border-color: var(--text-primary); }
.theme-dot-btn:hover { border-color: var(--text-secondary); opacity: 0.8; }

.preview-body {
  flex: 1; overflow: hidden; position: relative;
}
.preview-body.dragging { cursor: grabbing; user-select: none; }
.mermaid-wrap {
  position: absolute; inset: 10px;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.mermaid {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%; height: 100%;
  overflow: hidden;
}
.mermaid :deep(svg) {
  flex-shrink: 0;
  display: block;
  overflow: visible;
}

.preview-error {
  background: rgba(248, 81, 73, 0.1); border: 1px solid var(--accent-danger);
  border-radius: 8px; padding: 20px; max-width: 500px;
}
.error-icon { font-size: 24px; margin-bottom: 8px; }
.error-title { font-weight: 700; color: var(--accent-danger); margin-bottom: 8px; }
.error-msg {
  font-family: var(--code-font); font-size: 12px; color: var(--accent-danger);
  white-space: pre-wrap; word-break: break-all;
}
.preview-empty { color: var(--text-muted); padding: 40px; text-align: center; }

/* Fullscreen */
:global(.fullscreen-overlay) {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(255, 255, 255, 0.95);
  display: flex; align-items: center; justify-content: center;
}
.fullscreen-content { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; }
.fullscreen-close {
  position: absolute; top: 8px; right: 8px; z-index: 1;
  background: var(--bg-tertiary); border: 1px solid var(--border-color);
  color: var(--text-primary); font-size: 18px; cursor: pointer;
  width: 32px; height: 32px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
}
.fullscreen-close:hover { background: var(--bg-hover); }
.fullscreen-body { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; width: 100%; }
.fullscreen-body .mermaid { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; overflow: hidden; }
.fullscreen-body .mermaid :deep(svg) {
  max-width: 100%; max-height: 100%;
  flex-shrink: 0;
}
.mermaid :deep(svg) {
  display: block; overflow: visible;
  width: auto; height: auto;
}
</style>
