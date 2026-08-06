export const DEFAULT_TREE_LIMITS = {
  maxNodes: 5000,
  maxTextBytes: 500 * 1024,
}

export function analyzeTreeRender(data, text = '', limits = DEFAULT_TREE_LIMITS) {
  const textBytes = new TextEncoder().encode(text).length
  if (textBytes > limits.maxTextBytes) {
    return { shouldRender: false, nodeCount: 0, textBytes, reason: 'text-size' }
  }

  const nodeCount = countNodes(data, limits.maxNodes)
  if (nodeCount > limits.maxNodes) {
    return { shouldRender: false, nodeCount, textBytes, reason: 'node-count' }
  }

  return { shouldRender: true, nodeCount, textBytes }
}

function countNodes(value, maxNodes) {
  let count = 0
  const stack = [value]
  while (stack.length > 0) {
    const current = stack.pop()
    count += 1
    if (count > maxNodes) return count
    if (current && typeof current === 'object') {
      const children = Array.isArray(current) ? current : Object.values(current)
      for (let i = 0; i < children.length; i += 1) {
        stack.push(children[i])
      }
    }
  }
  return count
}
