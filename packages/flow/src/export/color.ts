let normalizer: CanvasRenderingContext2D | null | undefined

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const LEGACY_RGB =
  /^rgba?\(\s*[\d.+%-]+\s*,\s*[\d.+%-]+\s*,\s*[\d.+%-]+(?:\s*,\s*[\d.+%-]+)?\s*\)$/i
const MODERN_RGB =
  /^rgba?\(\s*(?:[\d.+%-]+|none)\s+(?:[\d.+%-]+|none)\s+(?:[\d.+%-]+|none)(?:\s*\/\s*(?:[\d.+%-]+|none))?\s*\)$/i
const CSS_WIDE = /^(?:inherit|initial|unset|revert|revert-layer)$/i
const SAFE_CHARS = /^[a-z0-9#(),.%/+\-\s]+$/i
const UNSAFE_FUNC = /\b(?:url|expression)\s*\(/i
const COLOR_FUNC = /^(?:hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\((.*)\)$/i
const VAR_FUNC = /^var\(\s*--[a-z0-9_-]+(?:\s*,.*)?\)$/i
const NAMED_COLOR = /^[a-z]+$/i

const SRGB = (value: string) => HEX.test(value) || LEGACY_RGB.test(value)

function hasBalancedParens(value: string): boolean {
  let depth = 0
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth < 0) return false
      if (depth === 0 && i !== value.length - 1) return false
    }
  }
  return depth === 0
}

/**
 * Whether `value` has safe CSS color syntax (no quotes, markup, CSS
 * declarations, `url()`, or CSS-wide keywords like `inherit`).
 */
export function isSafeCssColor(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === 'none' || CSS_WIDE.test(trimmed)) return false
  if (!SAFE_CHARS.test(trimmed) || UNSAFE_FUNC.test(trimmed) || !hasBalancedParens(trimmed))
    return false
  if (trimmed.startsWith('#')) return HEX.test(trimmed)
  if (/^rgba?\(/i.test(trimmed)) return LEGACY_RGB.test(trimmed) || MODERN_RGB.test(trimmed)
  if (VAR_FUNC.test(trimmed)) return true
  if (COLOR_FUNC.test(trimmed)) return true
  return NAMED_COLOR.test(trimmed)
}

/**
 * A computed color as `rgb(…)`, `rgba(…)` or `#rrggbb`, which every SVG reader
 * understands. A canvas converts most colors as it parses them; colors it
 * keeps in another space (`oklab(…)`, `color(…)`) are painted on a pixel
 * and read back. Invalid or unsafe values return `''`.
 */
export function plainColor(color: string): string {
  const value = color.trim()
  if (!value || value === 'none') return value
  if (SRGB(value)) return value
  if (value.toLowerCase() === 'transparent') return 'rgba(0, 0, 0, 0)'
  if (!isSafeCssColor(value)) return ''
  if (normalizer === undefined)
    try {
      const sheet = document.createElement('canvas')
      sheet.width = sheet.height = 1
      normalizer = sheet.getContext('2d', { willReadFrequently: true })
    } catch {
      normalizer = null
    }
  if (!normalizer) return value
  normalizer.fillStyle = '#000'
  normalizer.fillStyle = value
  const parsed = String(normalizer.fillStyle)
  if (parsed === '#000000') {
    normalizer.fillStyle = '#fff'
    normalizer.fillStyle = value
    if (String(normalizer.fillStyle) === '#ffffff') return ''
  }
  if (SRGB(parsed)) return parsed
  normalizer.clearRect(0, 0, 1, 1)
  normalizer.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = normalizer.getImageData(0, 0, 1, 1).data
  if (a === 255) return `#${[r, g, b].map((n) => n!.toString(16).padStart(2, '0')).join('')}`
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a! / 255) * 1000) / 1000})`
}
