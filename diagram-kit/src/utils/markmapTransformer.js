import MarkdownIt from 'markdown-it'
import mdIns from 'markdown-it-ins'
import mdMark from 'markdown-it-mark'
import mdSub from 'markdown-it-sub'
import mdSup from 'markdown-it-sup'
import { buildTree } from 'markmap-html-parser'

const markdown = MarkdownIt({
  html: true,
  breaks: true
})
  .use(mdIns)
  .use(mdMark)
  .use(mdSub)
  .use(mdSup)

function cleanNode(node) {
  let current = node
  while (!current.content && current.children.length === 1) {
    current = current.children[0]
  }
  while (current.children.length === 1 && !current.children[0].content) {
    current = {
      ...current,
      children: current.children[0].children
    }
  }
  return {
    ...current,
    children: current.children.map(cleanNode)
  }
}

export function transformMarkdownToMarkmap(content, parserOptions) {
  const html = markdown.render(content, {})
  const root = cleanNode(buildTree(html, parserOptions))
  if (!root.content) root.content = ''
  return root
}
