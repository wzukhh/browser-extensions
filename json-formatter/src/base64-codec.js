/**
 * UTF-8 safe Base64 helpers — thin wrapper around the open-source
 * js-base64 library (BSD-3-Clause, https://github.com/dankogai/js-base64,
 * vendored verbatim at ./vendor/js-base64.mjs).
 *
 * @returns {{ success: boolean, content?: string, error?: string }}
 */
import { encode, decode, isValid } from './vendor/js-base64.mjs'

export function encodeBase64(text) {
  const input = String(text ?? '')
  if (!input) return { success: false, error: '请输入要编码的文本' }
  try {
    return { success: true, content: encode(input) }
  } catch (e) {
    return { success: false, error: `Base64 编码失败: ${e.message}` }
  }
}

export function decodeBase64(text) {
  const input = String(text ?? '').trim()
  if (!input) return { success: false, error: '请输入要解码的文本' }
  if (!isValid(input)) return { success: false, error: 'Base64 解码失败: 输入不是有效的 Base64' }
  try {
    return { success: true, content: decode(input) }
  } catch {
    return { success: false, error: 'Base64 解码失败: 输入不是有效的 Base64' }
  }
}
