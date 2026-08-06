/**
 * Generate type/class/struct definitions from a JSON string for the specified language.
 *
 * The generated code focuses on representing the shape of the JSON data — nested
 * objects become named types, arrays become typed lists, null values become optional
 * or `unknown` placeholders.
 *
 * @param {string} jsonStr - Raw JSON input
 * @param {string} lang    - One of: 'typescript', 'go', 'python', 'java', 'csharp', 'rust'
 * @returns {string} Generated source code, or an error comment on failure
 */
export function generateCode(jsonStr, lang) {
  try {
    const obj = JSON.parse(jsonStr)
    const typeName = 'Root'

    switch (lang) {
      case 'typescript': return generateTypeScript(obj, typeName)
      case 'go':         return generateGo(obj, typeName)
      case 'python':     return generatePython(obj, typeName)
      case 'java':       return generateJava(obj, typeName)
      case 'csharp':     return generateCSharp(obj, typeName)
      case 'rust':       return generateRust(obj, typeName)
      default:           return `// 不支持的语言: ${lang}`
    }
  } catch (e) {
    return `// 代码生成失败: ${e.message}`
  }
}

// ──────────────────────────────────────────────
// Type helpers
// ──────────────────────────────────────────────

/**
 * Infer the JSON type name for a given value.
 * Returns one of: 'string', 'number', 'boolean', 'null', 'array', 'object'.
 */
function jsonTypeOf(val) {
  if (val === null || val === undefined) return 'null'
  if (Array.isArray(val)) return 'array'
  return typeof val
}

/**
 * Sanitise a string to be a valid PascalCase identifier.
 */
function toPascalCase(str) {
  return str
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/(^\d)/, '_$1')
    .replace(/(?:^|_)([a-z])/g, (_, c) => c.toUpperCase())
}

function toCamelCase(str) {
  const pascal = toPascalCase(str)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

function toSnakeCase(str) {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
}

// ──────────────────────────────────────────────
// Shared: collect named sub-types from an object
// ──────────────────────────────────────────────

/**
 * Walk the JSON value and collect all nested objects as named type definitions.
 * Returns a Map<typeName, Map<propName, typeString>>.
 */
function collectTypes(val, name, collected = new Map(), visited = new WeakSet()) {
  if (visited.has(val)) return collected
  visited.add(val)

  if (Array.isArray(val)) {
    if (val.length > 0) {
      collectTypes(val[0], toPascalCase(name) + 'Item', collected, visited)
    }
    return collected
  }

  if (val === null || val === undefined || typeof val !== 'object') {
    return collected
  }

  // Object
  if (!collected.has(name)) {
    const props = new Map()
    collected.set(name, props)
  }

  const props = collected.get(name)
  for (const [key, value] of Object.entries(val)) {
    const propType = inferTypeName(value, key, collected, visited)
    props.set(key, propType)
  }

  return collected
}

/**
 * Return a string representing the type of a value, potentially recursing into
 * nested objects/arrays and collecting them.
 */
function inferTypeName(val, name, collected, visited) {
  const t = jsonTypeOf(val)

  if (t === 'null') return 'unknown'
  if (t === 'string') return 'string'
  if (t === 'number') return 'number'
  if (t === 'boolean') return 'boolean'

  if (t === 'array') {
    if (Array.isArray(val) && val.length > 0) {
      const elemType = inferTypeName(val[0], toPascalCase(name) + 'Item', collected, visited)
      return elemType + '[]'
    }
    return 'unknown[]'
  }

  // object
  if (t === 'object') {
    const typeName = toPascalCase(name)
    collectTypes(val, typeName, collected, visited)
    return typeName
  }

  return 'unknown'
}

// ──────────────────────────────────────────────
// TypeScript
// ──────────────────────────────────────────────

function generateTypeScript(obj, name) {
  const collected = new Map()
  collectTypes(obj, name, collected)

  const lines = []

  // Generate interfaces bottom-up (dependencies first)
  const order = topologicalSort(collected)
  for (const typeName of order) {
    const props = collected.get(typeName)
    lines.push(`export interface ${typeName} {`)
    for (const [key, type] of props) {
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`
      lines.push(`  ${safeKey}: ${type}`)
    }
    lines.push('}')
    lines.push('')
  }

  return lines.join('\n')
}

// ──────────────────────────────────────────────
// Go
// ──────────────────────────────────────────────

function generateGo(obj, name) {
  const collected = new Map()
  collectTypes(obj, name, collected)

  const lines = []
  const order = topologicalSort(collected)

  for (const typeName of order) {
    const props = collected.get(typeName)
    lines.push(`type ${typeName} struct {`)
    for (const [key, type] of props) {
      const goType = tsToGoType(type)
      const jsonTag = key
      lines.push(`  ${toPascalCase(key)} ${goType} \`json:"${jsonTag}"\``)
    }
    lines.push('}')
    lines.push('')
  }

  return lines.join('\n')
}

function tsToGoType(tsType) {
  const isArray = tsType.endsWith('[]')
  const base = isArray ? tsType.slice(0, -2) : tsType

  let goBase
  switch (base) {
    case 'string':  goBase = 'string'; break
    case 'number':  goBase = 'float64'; break
    case 'boolean': goBase = 'bool'; break
    case 'unknown': goBase = 'interface{}'; break
    default:        goBase = base; break  // named struct type
  }

  return isArray ? `[]${goBase}` : goBase
}

// ──────────────────────────────────────────────
// Python
// ──────────────────────────────────────────────

function generatePython(obj, name) {
  const collected = new Map()
  collectTypes(obj, name, collected)

  const lines = []
  lines.push('from dataclasses import dataclass')
  lines.push('from typing import List, Optional, Any')
  lines.push('')

  const order = topologicalSort(collected)

  for (const typeName of order) {
    const props = collected.get(typeName)
    lines.push('@dataclass')
    lines.push(`class ${typeName}:`)
    for (const [key, type] of props) {
      const pyType = tsToPythonType(type)
      lines.push(`    ${toCamelCase(key)}: ${pyType}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function tsToPythonType(tsType) {
  const isArray = tsType.endsWith('[]')
  const base = isArray ? tsType.slice(0, -2) : tsType

  let pyBase
  switch (base) {
    case 'string':  pyBase = 'str'; break
    case 'number':  pyBase = 'float'; break
    case 'boolean': pyBase = 'bool'; break
    case 'unknown': pyBase = 'Any'; break
    default:        pyBase = base; break
  }

  if (isArray) {
    return `List[${pyBase}]`
  }
  return pyBase
}

// ──────────────────────────────────────────────
// Java
// ──────────────────────────────────────────────

function generateJava(obj, name) {
  const collected = new Map()
  collectTypes(obj, name, collected)

  const lines = []
  const order = topologicalSort(collected)

  for (const typeName of order) {
    const props = collected.get(typeName)
    lines.push(`public class ${typeName} {`)
    // Fields
    for (const [key, type] of props) {
      const javaType = tsToJavaType(type)
      lines.push(`    private ${javaType} ${toCamelCase(key)};`)
    }
    lines.push('')
    // Getters & Setters
    for (const [key, type] of props) {
      const javaType = tsToJavaType(type)
      const pascalKey = toPascalCase(key)
      const camelKey = toCamelCase(key)
      lines.push(`    public ${javaType} get${pascalKey}() {`)
      lines.push(`        return ${camelKey};`)
      lines.push(`    }`)
      lines.push('')
      lines.push(`    public void set${pascalKey}(${javaType} ${camelKey}) {`)
      lines.push(`        this.${camelKey} = ${camelKey};`)
      lines.push(`    }`)
      lines.push('')
    }
    lines.push('}')
    lines.push('')
  }

  return lines.join('\n')
}

function tsToJavaType(tsType) {
  const isArray = tsType.endsWith('[]')
  const base = isArray ? tsType.slice(0, -2) : tsType

  let javaBase
  switch (base) {
    case 'string':  javaBase = 'String'; break
    case 'number':  javaBase = 'double'; break
    case 'boolean': javaBase = 'boolean'; break
    case 'unknown': javaBase = 'Object'; break
    default:        javaBase = base; break
  }

  return isArray ? `${javaBase}[]` : javaBase
}

// ──────────────────────────────────────────────
// C#
// ──────────────────────────────────────────────

function generateCSharp(obj, name) {
  const collected = new Map()
  collectTypes(obj, name, collected)

  const lines = []
  lines.push('using System.Text.Json.Serialization;')
  lines.push('')

  const order = topologicalSort(collected)

  for (const typeName of order) {
    const props = collected.get(typeName)
    lines.push(`public class ${typeName} {`)
    for (const [key, type] of props) {
      const csType = tsToCSharpType(type)
      lines.push(`    [JsonPropertyName("${key}")]`)
      lines.push(`    public ${csType} ${toPascalCase(key)} { get; set; }`)
    }
    lines.push('}')
    lines.push('')
  }

  return lines.join('\n')
}

function tsToCSharpType(tsType) {
  const isArray = tsType.endsWith('[]')
  const base = isArray ? tsType.slice(0, -2) : tsType

  let csBase
  switch (base) {
    case 'string':  csBase = 'string'; break
    case 'number':  csBase = 'double'; break
    case 'boolean': csBase = 'bool'; break
    case 'unknown': csBase = 'object'; break
    default:        csBase = base; break
  }

  return isArray ? `List<${csBase}>` : csBase
}

// ──────────────────────────────────────────────
// Rust
// ──────────────────────────────────────────────

function generateRust(obj, name) {
  const collected = new Map()
  collectTypes(obj, name, collected)

  const lines = []
  lines.push('use serde::{Deserialize, Serialize};')
  lines.push('')

  const order = topologicalSort(collected)

  for (const typeName of order) {
    const props = collected.get(typeName)
    // Derive macros
    lines.push('#[derive(Debug, Deserialize, Serialize)]')
    lines.push(`pub struct ${typeName} {`)
    for (const [key, type] of props) {
      const rsType = tsToRustType(type)
      lines.push(`    pub ${toSnakeCase(key)}: ${rsType},`)
    }
    lines.push('}')
    lines.push('')
  }

  return lines.join('\n')
}

function tsToRustType(tsType) {
  const isArray = tsType.endsWith('[]')
  const base = isArray ? tsType.slice(0, -2) : tsType

  let rsBase
  switch (base) {
    case 'string':  rsBase = 'String'; break
    case 'number':  rsBase = 'f64'; break
    case 'boolean': rsBase = 'bool'; break
    case 'unknown': rsBase = 'serde_json::Value'; break
    default:        rsBase = base; break
  }

  return isArray ? `Vec<${rsBase}>` : rsBase
}

// ──────────────────────────────────────────────
// Utility: topological sort of collected types
// ──────────────────────────────────────────────

/**
 * Return an array of type names ordered so that dependencies come first.
 */
function topologicalSort(collected) {
  const names = [...collected.keys()]
  const visited = new Set()
  const sorted = []

  function visit(name) {
    if (visited.has(name)) return
    visited.add(name)
    const props = collected.get(name)
    if (props) {
      for (const [, type] of props) {
        // Check if this property references another collected type
        const base = type.endsWith('[]') ? type.slice(0, -2) : type
        if (collected.has(base) && base !== name) {
          visit(base)
        }
      }
    }
    sorted.push(name)
  }

  for (const name of names) visit(name)
  return sorted
}
