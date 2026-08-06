import { reactive } from 'vue'

const state = reactive({
  theme: 'light',
  templatePanelOpen: false,
  versionPanelOpen: false,
  exportDialogOpen: false
})

export function useUiStore() {
  return state
}
