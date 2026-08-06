export const DEFAULT_BOTTOM_PANEL_EXPANDED = false

export function toggleBottomPanelExpanded(isExpanded) {
  return !isExpanded
}

export function getBottomPanelPresentation(isExpanded) {
  return {
    isCollapsed: !isExpanded,
    bodyHidden: !isExpanded,
    buttonText: isExpanded ? '收起' : '展开',
    buttonTitle: isExpanded ? '收起功能区' : '展开功能区',
    ariaExpanded: isExpanded ? 'true' : 'false',
    buttonPlacement: 'start',
  }
}
