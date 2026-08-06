<template>
  <Teleport to="body">
    <div v-if="dialog" class="dialog-overlay" :data-theme="uiStore.theme" @click.self="resolve(false)">
      <div class="dialog-card" :class="dialog.tone" role="dialog" aria-modal="true" :aria-labelledby="`${dialog.id}-title`">
        <button v-if="dialog.showClose" class="dialog-close" type="button" aria-label="关闭" @click="resolve(false)">✕</button>
        <div class="dialog-header">
          <div>
            <div :id="`${dialog.id}-title`" class="dialog-title">{{ dialog.title }}</div>
            <div v-if="dialog.message" class="dialog-message">{{ dialog.message }}</div>
          </div>
        </div>
        <div v-if="dialog.detail" class="dialog-detail">{{ dialog.detail }}</div>
        <div class="dialog-actions">
          <button
            v-for="action in dialog.actions"
            :key="String(action.value)"
            class="dialog-btn"
            :class="[action.variant || 'secondary', { 'has-icon': action.icon }]"
            type="button"
            @click="resolve(action.value)">
            <span>{{ action.label }}</span>
            <img v-if="action.icon" :src="action.icon" class="dialog-btn-icon" alt="">
          </button>
        </div>
      </div>
    </div>

    <div class="toast-stack" :data-theme="uiStore.theme" aria-live="polite">
      <div v-for="toast in toasts" :key="toast.id" class="toast" :class="toast.tone">
        <div v-if="toast.title" class="toast-title">{{ toast.title }}</div>
        <div class="toast-message">{{ toast.message }}</div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useDialogStore } from '../stores/dialogStore.js'
import { useUiStore } from '../stores/uiStore.js'

const dialogStore = useDialogStore()
const uiStore = useUiStore()
const dialog = computed(() => dialogStore.state.dialog)
const toasts = computed(() => dialogStore.state.toasts)

function resolve(value) {
  dialogStore.closeDialog(value)
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed; inset: 0; z-index: 10000;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.58);
}
.dialog-card {
  width: min(420px, calc(100vw - 32px));
  background: var(--bg-primary, #ffffff);
  color: var(--text-primary, #1f2328);
  border: 1px solid rgba(140, 149, 159, 0.55);
  border-radius: 8px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.34), 0 2px 10px rgba(0, 0, 0, 0.16);
  padding: 22px;
  position: relative;
  overflow: hidden;
}
.dialog-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  z-index: 1;
}
.dialog-close:hover {
  background: var(--bg-hover);
  border-color: var(--border-color);
  color: var(--text-primary);
}
.dialog-card::before {
  content: "";
  position: absolute;
  left: 0; top: 0; right: 0; height: 4px;
  background: var(--accent-primary);
}
.dialog-card.danger::before { background: var(--accent-danger); }
.dialog-card.warning::before { background: var(--accent-warning); }
.dialog-card.success::before { background: var(--accent-success); }
.dialog-header {
  display: flex;
  align-items: flex-start;
  padding-right: 26px;
}
.dialog-title { font-size: 16px; font-weight: 700; color: var(--text-primary); line-height: 1.35; }
.dialog-message { margin-top: 6px; color: var(--text-secondary); font-size: 13px; line-height: 1.55; }
.dialog-detail {
  margin-top: 14px; padding: 11px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 12px; line-height: 1.5;
  white-space: pre-wrap;
}
.dialog-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  margin-top: 22px;
}
.dialog-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  min-width: 0;
  width: 100%;
  transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
}
.dialog-btn-icon {
  width: 16px;
  height: 16px;
  display: block;
  flex-shrink: 0;
}
.dialog-btn:hover { background: var(--bg-hover); }
.dialog-btn.primary {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
  box-shadow: 0 4px 12px rgba(9, 105, 218, 0.22);
}
.dialog-btn.danger {
  background: var(--accent-danger);
  border-color: var(--accent-danger);
  color: #fff;
  box-shadow: 0 4px 12px rgba(207, 34, 46, 0.2);
}
.dialog-btn.secondary { background: var(--bg-primary); }
.toast-stack {
  position: fixed; right: 16px; bottom: 16px; z-index: 10001;
  display: flex; flex-direction: column; gap: 8px;
}
.toast {
  min-width: 220px; max-width: 360px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  box-shadow: 0 10px 30px rgba(31, 35, 40, 0.14);
  border-left: 4px solid var(--accent-primary);
}
.toast.success { border-left-color: var(--accent-success); }
.toast.danger { border-left-color: var(--accent-danger); }
.toast.warning { border-left-color: var(--accent-warning); }
.toast-title { font-size: 12px; font-weight: 700; color: var(--text-primary); margin-bottom: 2px; }
.toast-message { font-size: 12px; color: var(--text-secondary); line-height: 1.4; }
</style>
