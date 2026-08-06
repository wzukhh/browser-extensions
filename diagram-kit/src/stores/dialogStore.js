import { reactive } from 'vue'

let dialogId = 0
let toastId = 0

const state = reactive({
  dialog: null,
  toasts: []
})

function nextDialogId() {
  dialogId += 1
  return `dialog-${dialogId}`
}

function closeDialog(result) {
  if (!state.dialog) return
  const resolve = state.dialog.resolve
  state.dialog = null
  resolve(result)
}

function openDialog(options) {
  return new Promise((resolve) => {
    state.dialog = {
      id: nextDialogId(),
      title: options.title || '确认操作',
      message: options.message || '',
      detail: options.detail || '',
      tone: options.tone || 'default',
      showClose: !!options.showClose,
      actionsAlign: options.actionsAlign || '',
      actions: options.actions || [
        { label: '取消', value: false, variant: 'secondary' },
        { label: '确认', value: true, variant: 'primary' }
      ],
      resolve
    }
  })
}

function confirm(options = {}) {
  return openDialog({
    ...options,
    actions: options.actions || [
      { label: options.cancelText || '取消', value: false, variant: 'secondary' },
      { label: options.confirmText || '确认', value: true, variant: options.variant || 'primary' }
    ]
  })
}

function choose(options = {}) {
  return openDialog(options)
}

function notify(options = {}) {
  toastId += 1
  const id = `toast-${toastId}`
  const toast = {
    id,
    title: options.title || '',
    message: options.message || '',
    tone: options.tone || 'default'
  }
  state.toasts.push(toast)
  window.setTimeout(() => {
    dismissToast(id)
  }, options.duration || 2600)
  return id
}

function dismissToast(id) {
  const idx = state.toasts.findIndex(toast => toast.id === id)
  if (idx !== -1) state.toasts.splice(idx, 1)
}

export function useDialogStore() {
  return {
    state,
    confirm,
    choose,
    notify,
    closeDialog,
    dismissToast
  }
}
