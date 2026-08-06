/**
 * Core JSON Utility Functions
 *
 * Pure functions for formatting, compressing, validating, escaping,
 * unescaping, and sorting JSON strings.
 */

// ──────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────

/**
 * Convert a character position within a string to a {line, col} pair.
 * Lines and columns are 1-based.
 */
function posToLineCol(str, pos) {
  const lines = str.slice(0, pos).split("\n");
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

/**
 * Recursively sort the keys of an object (and nested objects/arrays).
 */
function sortObj(obj, order) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => sortObj(item, order));

  const keys = Object.keys(obj).sort(
    order === "asc"
      ? (a, b) => a.localeCompare(b)
      : (a, b) => b.localeCompare(a)
  );

  const result = {};
  for (const key of keys) {
    result[key] = sortObj(obj[key], order);
  }
  return result;
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Format (pretty-print) a JSON string.
 *
 * @param {string} str  - Raw JSON string.
 * @param {number} [indent=2] - Number of spaces for indentation.
 * @returns {string} Formatted JSON string.
 * @throws {SyntaxError} If the input is not valid JSON.
 */
export function formatJSON(str, indent = 2) {
  const obj = JSON.parse(str);
  return JSON.stringify(obj, null, indent);
}

/**
 * Compress a JSON string by removing all unnecessary whitespace.
 *
 * @param {string} str - Raw JSON string.
 * @returns {string} Compressed (minified) JSON string.
 * @throws {SyntaxError} If the input is not valid JSON.
 */
export function compressJSON(str) {
  const obj = JSON.parse(str);
  return JSON.stringify(obj);
}

/**
 * Validate a JSON string and return a friendly result object.
 *
 * On success:  { valid: true }
 * On failure:  { valid: false, error: <message>, position: {line, col} }
 *
 * @param {string} str - Raw JSON string.
 * @returns {{ valid: boolean, error?: string, position?: {line: number, col: number} }}
 */
export function validateJSON(str) {
  try {
    JSON.parse(str);
    return { valid: true };
  } catch (e) {
    const msg = e.message;
    const posMatch = msg.match(/position\s+(\d+)/);
    const position = posMatch
      ? posToLineCol(str, parseInt(posMatch[1], 10))
      : { line: 0, col: 0 };

    return {
      valid: false,
      error: msg,
      position,
    };
  }
}

/**
 * Escape a JSON string so that special characters (quotes, backslashes,
 * control characters) become their JSON escape sequences.
 *
 * The input should be a valid JSON string (i.e. `JSON.parse(str)` succeeds
 * and yields a string).
 *
 * @param {string} str - A valid JSON string value.
 * @returns {string} The escaped content (without outer quotes).
 * @throws {SyntaxError} If the input is not valid JSON.
 */
export function escapeJSON(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Unescape a JSON-escaped string back to its original form.
 *
 * The input should be the content of a JSON string (without outer quotes)
 * containing escape sequences such as \" \\ \n \t etc.
 *
 * @param {string} str - Escaped string content (no outer quotes).
 * @returns {string} The unescaped string.
 * @throws {SyntaxError} If the escaped content is malformed.
 */
export function unescapeJSON(str) {
  // Single left-to-right pass: each backslash followed by a char is an escape.
  // This correctly handles \\n (escaped backslash + n → \n) distinct from
  // \n (backslash + n → newline).
  return str.replace(/\\(.)/g, (_, char) => {
    switch (char) {
      case 'n': return '\n'
      case 'r': return '\r'
      case 't': return '\t'
      case '"': return '"'
      case '\\': return '\\'
      default: return _ // keep unrecognized escapes as-is
    }
  })
}

/**
 * Sort the keys of a JSON object (ascending or descending) recursively.
 *
 * @param {string} str   - Raw JSON string.
 * @param {string} [order='asc'] - Sort order: 'asc' or 'desc'.
 * @returns {string} Formatted JSON with keys sorted (2-space indent).
 * @throws {SyntaxError} If the input is not valid JSON.
 */
export function sortJSON(str, order = "asc") {
  const obj = JSON.parse(str);
  return JSON.stringify(sortObj(obj, order), null, 2);
}
