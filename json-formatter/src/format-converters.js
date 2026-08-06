import { stringify as tomlStringify } from 'smol-toml'
import { dump as yamlDump } from 'js-yaml'

/**
 * Convert a JSON string to the specified format.
 *
 * @param {string} jsonStr - Raw JSON input
 * @param {string} action  - One of: 'to-yaml', 'to-xml', 'to-toml'
 * @returns {{ success: boolean, content?: string, error?: string }}
 */
export function convertJSON(jsonStr, action) {
  try {
    const obj = JSON.parse(jsonStr)
    let content

    switch (action) {
      case 'to-yaml':
        content = jsonToYaml(obj)
        break
      case 'to-xml':
        content = jsonToXml(obj)
        break
      case 'to-toml':
        content = jsonToToml(obj)
        break
      default:
        return { success: false, error: `未知转换动作: ${action}` }
    }

    return { success: true, content }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ──────────────────────────────────────────────
// YAML — delegate to js-yaml
// ──────────────────────────────────────────────

function jsonToYaml(obj) {
  return yamlDump(obj, {
    indent: 2,
    lineWidth: -1,       // no line wrapping
    noRefs: true,        // avoid YAML references
    sortKeys: false,     // preserve key order
    forceQuotes: false,
  })
}

// ──────────────────────────────────────────────
// XML — simple generic serializer
// ──────────────────────────────────────────────

const XML_PROLOG = '<?xml version="1.0" encoding="UTF-8"?>\n'

function jsonToXml(obj, name = 'root', depth = 0) {
  const indent = '  '.repeat(depth)

  if (obj === null || obj === undefined) {
    return `${indent}<${name}/>\n`
  }

  const type = typeof obj

  // Primitives → self-closing or text-only element
  if (type !== 'object' || Array.isArray(obj)) {
    if (Array.isArray(obj)) {
      // Array → repeated element with the parent name
      return obj.map(item => jsonToXml(item, name, depth)).join('')
    }
    // String, number, boolean
    const escaped = String(obj)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
    return `${indent}<${name}>${escaped}</${name}>\n`
  }

  // Object
  const keys = Object.keys(obj)
  if (keys.length === 0) {
    return `${indent}<${name}/>\n`
  }

  let xml = `${indent}<${name}>\n`
  for (const key of keys) {
    xml += jsonToXml(obj[key], key, depth + 1)
  }
  xml += `${indent}</${name}>\n`
  return xml
}

// ──────────────────────────────────────────────
// TOML — delegate to smol-toml
// ──────────────────────────────────────────────

function jsonToToml(obj) {
  // smol-toml needs the value wrapped under a key — we use "root"
  const wrapped = { root: obj }
  return tomlStringify(wrapped)
}
