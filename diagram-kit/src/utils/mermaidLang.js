import { StreamLanguage } from '@codemirror/language'

export const mermaidLanguage = StreamLanguage.define({
  startState: () => ({ inComment: false, inString: false, stringChar: null }),

  token: (stream, state) => {
    if (stream.match(/^%%[^\n]*/)) return 'comment'

    if (state.inString) {
      const next = stream.next()
      if (next === state.stringChar) { state.inString = false; state.stringChar = null }
      return 'string'
    }
    if (stream.match(/^["']/)) {
      state.inString = true
      state.stringChar = stream.current()
      return 'string'
    }

    if (stream.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram[v2]?|erDiagram|gantt|pie|quadrantChart|requirementDiagram|journey|gitgraph|mindmap|timeline|xychart-beta)\b/i)) {
      return 'keyword'
    }
    if (stream.match(/^(TB|BT|RL|LR|top|bottom|right|left)\b/i)) return 'keyword'
    if (stream.match(/^(-{1,2}>|-->|==>|\.\.->|==|--|\.\.)/)) return 'operator'
    if (stream.match(/^\[[^\]]*\]|^\([^\)]*\)|^\{[^\}]*\}|^\(\([^\)]*\)\)|^\[[^\]]*\[\]/)) return 'typeName'
    if (stream.match(/^\[[^\]]*\]/)) return 'label'
    if (stream.match(/^\d+\.?\d*/)) return 'number'
    if (stream.match(/^(subgraph|end|direction|link|click|style|classDef|class)\b/i)) return 'keyword'

    stream.next()
    return null
  },

  blankLine: (state) => { state.inComment = false }
})
