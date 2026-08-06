<template>
  <div class="preview-panel">
    <div class="preview-header">
      <span class="preview-title">Markmap 预览</span>
      <span v-if="errorMsg" class="preview-error-badge">错误</span>
      <div class="preview-controls" v-if="!errorMsg">
        <button class="preview-btn" @click="fit">自适应</button>
      </div>
    </div>
    <div class="preview-body">
      <div v-if="errorMsg" class="preview-error">
        <div class="error-icon">⚠</div>
        <div class="error-title">渲染错误</div>
        <pre class="error-msg">{{ errorMsg }}</pre>
      </div>
      <svg
        v-show="content.trim() && !errorMsg"
        ref="svgRef"
        class="markmap rendered-diagram"
        aria-label="Markmap preview">
      </svg>
      <div v-if="!content.trim() && !errorMsg" class="preview-empty">输入 Markdown 开始预览</div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Markmap } from 'markmap-view'
import { transformMarkdownToMarkmap } from '../utils/markmapTransformer.js'
import { canFitMarkmap } from '../utils/markmapViewGuard.js'

const props = defineProps({ content: { type: String, default: '' } })
const emit = defineEmits(['svgReady'])

const svgRef = ref(null)
const errorMsg = ref('')
let markmap = null
let renderTimer = null
let fitTimer = null
let resizeObserver = null
let renderId = 0
let disposed = false

watch(() => props.content, () => {
  clearTimeout(renderTimer)
  renderTimer = setTimeout(() => renderMarkmap(), 250)
}, { immediate: true })

async function renderMarkmap() {
  const markdown = props.content.trim()
  if (!svgRef.value) return
  if (!markdown) {
    errorMsg.value = ''
    destroyMarkmap()
    return
  }

  renderId += 1
  const currentId = renderId
  try {
    const root = transformMarkdownToMarkmap(markdown)
    await nextTick()
    await nextFrame()
    if (currentId !== renderId) return
    if (!markmap) {
      markmap = Markmap.create(svgRef.value, {
        autoFit: false,
        duration: 250,
        initialExpandLevel: -1,
        pan: true,
        zoom: true
      })
    }
    await markmap.setData(root)
    if (currentId !== renderId || disposed) return
    await fitWhenReady()
    errorMsg.value = ''
    emit('svgReady', svgRef.value.outerHTML)
  } catch (err) {
    if (currentId !== renderId) return
    errorMsg.value = err.message || String(err)
  }
}

async function fit() {
  await fitWhenReady()
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve))
}

async function fitWhenReady() {
  await nextFrame()
  if (!svgRef.value || !markmap || disposed || !canFitMarkmap(svgRef.value, markmap)) return false
  await markmap.fit()
  return true
}

function scheduleFit() {
  clearTimeout(fitTimer)
  fitTimer = setTimeout(() => {
    fitWhenReady()
  }, 80)
}

function destroyMarkmap() {
  markmap?.destroy()
  markmap = null
  if (svgRef.value) svgRef.value.innerHTML = ''
}

onMounted(() => {
  disposed = false
  if (typeof ResizeObserver !== 'undefined' && svgRef.value) {
    resizeObserver = new ResizeObserver(() => scheduleFit())
    resizeObserver.observe(svgRef.value)
  }
  renderMarkmap()
})

onBeforeUnmount(() => {
  disposed = true
  renderId += 1
  clearTimeout(renderTimer)
  clearTimeout(fitTimer)
  resizeObserver?.disconnect()
  resizeObserver = null
  destroyMarkmap()
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
.preview-body {
  flex: 1; overflow: hidden; position: relative;
  display: flex; align-items: stretch; justify-content: stretch;
}
.markmap {
  width: 100%;
  height: 100%;
  display: block;
  background: #fff;
}
.preview-error {
  margin: auto;
  background: rgba(248, 81, 73, 0.1); border: 1px solid var(--accent-danger);
  border-radius: 8px; padding: 20px; max-width: 500px;
}
.error-icon { font-size: 24px; margin-bottom: 8px; }
.error-title { font-weight: 700; color: var(--accent-danger); margin-bottom: 8px; }
.error-msg {
  font-family: var(--code-font); font-size: 12px; color: var(--accent-danger);
  white-space: pre-wrap; word-break: break-all;
}
.preview-empty { color: var(--text-muted); padding: 40px; text-align: center; margin: auto; }
</style>
