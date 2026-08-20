<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <img src="/icons/DiagramKit.svg" class="brand-icon" alt=""> <span class="toolbar-brand">DiagramKit</span>
    </div>
    <div class="toolbar-center"><TabBar /></div>
    <div class="toolbar-right">
      <span class="toolbar-section-label">导出</span>
      <button class="tool-btn icon-btn" @click="emit('export', 'png')" data-tip="导出 PNG">
        <img :src="pngIcon" class="tb-icon" alt="PNG">
      </button>
      <button class="tool-btn icon-btn" @click="emit('export', 'svg')" data-tip="导出 SVG">
        <img :src="svgIcon" class="tb-icon" alt="SVG">
      </button>

      <div class="tb-sep"></div>

      <div class="template-entry">
        <span class="toolbar-section-label">模板库</span>
        <button class="tool-btn icon-btn" @click="togglePanel('templatePanelOpen')" data-tip="模板库">
          <img :src="tmplIcon" class="tb-icon" alt="模板库">
        </button>
      </div>

      <div class="tb-sep"></div>

      <button class="tool-btn icon-btn" @click="handleSave" data-tip="保存">
        <img :src="saveIcon" class="tb-icon" alt="保存">
      </button>
      <button class="tool-btn icon-btn" @click="togglePanel('versionPanelOpen')" data-tip="图表存档">
        <img :src="histIcon" class="tb-icon" alt="存档">
      </button>
    </div>
  </div>
</template>

<script setup>
import { useUiStore } from '../stores/uiStore.js'
import TabBar from './TabBar.vue'

const emit = defineEmits(['save', 'export'])
const uiStore = useUiStore()

const pngIcon = '/icons/png.svg'
const svgIcon = '/icons/SVG图标.svg'
const tmplIcon = '/icons/模板库.svg'
const saveIcon = '/icons/保存.svg'
const histIcon = '/icons/历史.svg'

function handleSave() { emit('save') }
function togglePanel(key) { uiStore[key] = !uiStore[key] }
</script>

<style scoped>
.toolbar {
  display: flex; align-items: center; height: var(--header-height);
  background: var(--toolbar-bg); border-bottom: 1px solid var(--border-color); padding: 0 8px; gap: 8px;
}
.toolbar-left { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.brand-icon { width: 20px; height: 20px; display: block; }
.toolbar-brand {
  font-weight: 700; font-size: 14px; color: var(--accent-primary);
  letter-spacing: -0.3px;
}
.toolbar-center { flex: 1; display: flex; align-items: center; overflow: hidden; }
.toolbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-right: 12px; }
.template-entry { display: flex; align-items: center; gap: 6px; }
.toolbar-section-label {
  font-size: 12px;
  line-height: 1;
  color: var(--text-secondary);
  font-weight: 600;
  white-space: nowrap;
}
.tool-btn {
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  cursor: pointer; padding: 0;
  width: 30px; height: 30px;
}
.tool-btn:hover { background: var(--bg-hover); }
.tb-icon { width: 18px; height: 18px; display: block; }
.tb-sep { width: 1px; height: 22px; background: var(--border-color); margin: 0 6px; flex-shrink: 0; }
</style>
