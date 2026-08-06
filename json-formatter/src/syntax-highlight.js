const CODE_KEYWORDS = {
  typescript: [
    'export', 'interface', 'type', 'class', 'extends', 'implements', 'readonly',
    'public', 'private', 'protected', 'const', 'let', 'var', 'function', 'return',
    'import', 'from', 'null', 'undefined', 'true', 'false',
  ],
  go: [
    'type', 'struct', 'package', 'import', 'func', 'return', 'map', 'interface',
    'string', 'bool', 'float64', 'int', 'true', 'false', 'nil',
  ],
  python: [
    'from', 'import', 'class', 'def', 'return', 'None', 'True', 'False',
    'str', 'float', 'int', 'bool', 'list', 'Any', 'List', 'Optional',
  ],
  java: [
    'public', 'private', 'protected', 'class', 'static', 'final', 'return',
    'String', 'Double', 'Boolean', 'List', 'Object', 'null', 'true', 'false',
  ],
  csharp: [
    'public', 'private', 'protected', 'class', 'string', 'double', 'bool',
    'object', 'List', 'get', 'set', 'null', 'true', 'false',
  ],
  rust: [
    'pub', 'struct', 'enum', 'impl', 'fn', 'return', 'String', 'f64', 'bool',
    'Vec', 'Option', 'serde', 'true', 'false', 'None',
  ],
  json: ['true', 'false', 'null'],
}

const CODE_TYPES = [
  'string', 'number', 'boolean', 'unknown', 'Root', 'String', 'Double',
  'Boolean', 'Object', 'List', 'Any', 'Optional', 'Vec', 'Option', 'f64',
  'bool', 'str', 'float', 'int',
]

export function highlightSyntax(code, language = 'plain') {
  const source = String(code ?? '')
  const lang = normalizeLanguage(language)

  if (lang === 'xml') return highlightXml(source)
  if (lang === 'yaml' || lang === 'toml') return highlightConfig(source, lang)
  if (CODE_KEYWORDS[lang]) return highlightCode(source, lang)

  return escapeHtml(source)
}

function normalizeLanguage(language) {
  return String(language || 'plain').toLowerCase().replace(/#/g, 'sharp')
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function span(className, value) {
  return `<span class="${className}">${escapeHtml(value)}</span>`
}

function highlightCode(source, language) {
  const keywords = CODE_KEYWORDS[language] || []
  const rules = [
    { className: 'syntax-comment', regex: /\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\//y },
    { className: 'syntax-string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/y },
    { className: 'syntax-number', regex: /\b-?(?:\d+\.\d+|\d+)\b/y },
    { className: 'syntax-keyword', regex: keywordRegex(keywords) },
    { className: 'syntax-type', regex: keywordRegex(CODE_TYPES) },
    { className: 'syntax-decorator', regex: /@[A-Za-z_][A-Za-z0-9_]*/y },
  ].filter(rule => rule.regex)

  return tokenize(source, rules)
}

function highlightConfig(source, language) {
  return source.split('\n').map(line => {
    let output = ''
    let rest = line
    const keyMatch = rest.match(/^(\s*)([A-Za-z0-9_.-]+)(\s*[:=])/)
    if (keyMatch) {
      output += escapeHtml(keyMatch[1])
      output += span('syntax-key', keyMatch[2])
      output += escapeHtml(keyMatch[3])
      rest = rest.slice(keyMatch[0].length)
    }

    const commentRule = language === 'toml'
      ? /#[^\n]*/y
      : /#[^\n]*/y
    output += tokenize(rest, [
      { className: 'syntax-comment', regex: commentRule },
      { className: 'syntax-string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y },
      { className: 'syntax-number', regex: /\b-?(?:\d+\.\d+|\d+)\b/y },
      { className: 'syntax-keyword', regex: /\b(?:true|false|null)\b/y },
    ])
    return output
  }).join('\n')
}

function highlightXml(source) {
  let output = ''
  let pos = 0
  const tagRegex = /<\/?[^<>]+?>/g
  let match

  while ((match = tagRegex.exec(source))) {
    output += escapeHtml(source.slice(pos, match.index))
    output += highlightXmlTag(match[0])
    pos = match.index + match[0].length
  }

  output += escapeHtml(source.slice(pos))
  return output
}

function highlightXmlTag(tag) {
  const match = tag.match(/^<(\s*\/?\s*)([A-Za-z_:][A-Za-z0-9_:.-]*)([\s\S]*?)(\s*\/?)>$/)
  if (!match) return escapeHtml(tag)

  const [, prefix, name, attrs, suffix] = match
  return '&lt;'
    + escapeHtml(prefix)
    + span('syntax-tag', name)
    + highlightXmlAttrs(attrs)
    + escapeHtml(suffix)
    + '&gt;'
}

function highlightXmlAttrs(attrs) {
  let output = ''
  let pos = 0
  const attrRegex = /([A-Za-z_:][A-Za-z0-9_:.-]*)(\s*=\s*)("(?:[^"]*)"|'(?:[^']*)')/g
  let match

  while ((match = attrRegex.exec(attrs))) {
    output += escapeHtml(attrs.slice(pos, match.index))
    output += span('syntax-attr', match[1])
    output += escapeHtml(match[2])
    output += span('syntax-string', match[3])
    pos = match.index + match[0].length
  }

  output += escapeHtml(attrs.slice(pos))
  return output
}

function tokenize(source, rules) {
  let output = ''
  let pos = 0

  while (pos < source.length) {
    let matched = false
    for (const rule of rules) {
      rule.regex.lastIndex = pos
      const match = rule.regex.exec(source)
      if (match && match.index === pos) {
        output += span(rule.className, match[0])
        pos += match[0].length
        matched = true
        break
      }
    }

    if (!matched) {
      output += escapeHtml(source[pos])
      pos += 1
    }
  }

  return output
}

function keywordRegex(words) {
  if (!words.length) return null
  const escaped = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'y')
}
