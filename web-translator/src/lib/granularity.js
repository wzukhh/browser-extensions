/**
 * 文本粒度识别：单词 / 短语 / 句子 / 段落
 * 划词后根据文本特征自动决定翻译详情的深度。
 */

export const GRANULARITY = {
  WORD: 'word',
  PHRASE: 'phrase',
  SENTENCE: 'sentence',
  PARAGRAPH: 'paragraph',
}

/**
 * 清洗选中文本：去首尾空白、合并多余换行与空格。
 */
export function normalizeText(raw) {
  return (raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 判断粒度。
 * 规则：
 *  - 1 个词            → word（词典详解）
 *  - 2 个词            → phrase（固定搭配/惯用法）
 *  - 单行且 ≤ 4 句      → sentence（翻译 + 语法/生词批注）
 *  - 多行或 > 4 句      → paragraph（概括 + 翻译 + 要点）
 */
export function detectGranularity(text) {
  const t = normalizeText(text)
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length === 0) return null
  if (words.length === 1) return GRANULARITY.WORD
  if (words.length === 2) return GRANULARITY.PHRASE

  const sentenceCount = (t.match(/[.!?…]+(\s|$)/g) || []).length + (t.includes('\n') ? 0 : 1)
  const isMultiLine = t.includes('\n')

  if (!isMultiLine && sentenceCount <= 4) return GRANULARITY.SENTENCE
  return GRANULARITY.PARAGRAPH
}
