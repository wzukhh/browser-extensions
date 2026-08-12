/**
 * URL percent-encoding helpers.
 *
 * Encoding uses the platform-standard encodeURIComponent (full encoding —
 * spaces, &, ?, etc.), suitable for query parameter values. Decoding tries
 * decodeURIComponent first and falls back to decodeURI (which leaves
 * reserved characters undecoded) before giving up.
 *
 * @returns {{ success: boolean, content?: string, error?: string }}
 */
export function encodeURL(text) {
  const input = String(text ?? '')
  if (!input) return { success: false, error: '请输入要编码的文本' }
  return { success: true, content: encodeURIComponent(input) }
}

export function decodeURL(text) {
  const input = String(text ?? '')
  if (!input) return { success: false, error: '请输入要解码的文本' }
  try {
    return { success: true, content: decodeURIComponent(input) }
  } catch {
    try {
      return { success: true, content: decodeURI(input) }
    } catch {
      return { success: false, error: 'URL 解码失败: 存在非法的 % 转义序列' }
    }
  }
}
