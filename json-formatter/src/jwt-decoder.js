/**
 * Decode a JWT token into its header, payload, and signature components.
 *
 * A JWT consists of three dot-separated base64url-encoded segments:
 *   header.payload.signature
 *
 * The header and payload are JSON objects; the signature is binary data
 * presented as a hex string.
 *
 * @param {string} token - A JWT string
 * @returns {{ success: boolean, header?: string, payload?: string, pretty?: string, error?: string }}
 */
export function decodeJWT(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return { success: false, error: '无效的 JWT 格式: 需要三个由点分隔的部分' }
    }

    const [headerB64, payloadB64, signatureB64] = parts

    const header = JSON.parse(base64UrlDecode(headerB64))
    const payload = JSON.parse(base64UrlDecode(payloadB64))
    const signatureBytes = base64UrlToBytes(signatureB64)

    const headerStr = JSON.stringify(header, null, 2)
    const payloadStr = JSON.stringify(payload, null, 2)
    const signatureHex = bytesToHex(signatureBytes)

    const result = {
      header,
      payload,
      signatureHex,
      algorithm: header.alg || 'unknown',
      type: header.typ || 'JWT',
    }

    const pretty = `Header (alg: ${result.algorithm}, typ: ${result.type})\n${headerStr}\n\nPayload\n${payloadStr}\n\nSignature (${signatureBytes.length} bytes)\n${signatureHex}`

    return { success: true, header: headerStr, payload: payloadStr, pretty }
  } catch (e) {
    return { success: false, error: `JWT 解码失败: ${e.message}` }
  }
}

// ──────────────────────────────────────────────
// Base64url helpers
// ──────────────────────────────────────────────

/**
 * Decode a base64url-encoded string to a UTF-8 string.
 *
 * Base64url uses '-' instead of '+', '_' instead of '/',
 * and omits padding '=' characters.
 */
function base64UrlDecode(str) {
  let base64 = str
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return atob(base64)
}

/**
 * Decode a base64url-encoded string to a Uint8Array of bytes.
 */
function base64UrlToBytes(str) {
  const decoded = base64UrlDecode(str)
  const bytes = new Uint8Array(decoded.length)
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i)
  }
  return bytes
}

/**
 * Convert a Uint8Array to a lowercase hex string.
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
