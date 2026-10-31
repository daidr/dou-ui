let normalizer: CanvasRenderingContext2D | null | undefined

const SRGB = /^(#|rgba?\()/

/**
 * A computed color as `rgb(…)`, `rgba(…)` or `#rrggbb`, which every SVG reader
 * understands. A canvas converts most colors as it parses them; colors it
 * keeps in another space (`oklab(…)`, `color(…)`) are painted on a pixel
 * and read back.
 */
export function plainColor(color: string): string {
  const value = color.trim()
  if (!value || value === 'none' || SRGB.test(value)) return value
  if (value === 'transparent') return 'rgba(0, 0, 0, 0)'
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
  if (SRGB.test(parsed)) return parsed
  normalizer.clearRect(0, 0, 1, 1)
  normalizer.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = normalizer.getImageData(0, 0, 1, 1).data
  if (a === 255) return `#${[r, g, b].map((n) => n!.toString(16).padStart(2, '0')).join('')}`
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a! / 255) * 1000) / 1000})`
}
