let normalizer: CanvasRenderingContext2D | null | undefined

const SRGB = /^(#|rgba?\()/

/**
 * A computed color as `#rrggbb` or `rgba(…)`, which every SVG reader
 * understands. A canvas converts most colors as it parses them; colors
 * it keeps in another space (`oklab(…)`, `color(…)`) are painted on a
 * pixel and read back.
 */
export function plainColor(color: string) {
  if (SRGB.test(color)) return color
  if (normalizer === undefined)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      normalizer = canvas.getContext('2d', { willReadFrequently: true })
    } catch {
      normalizer = null
    }
  if (!normalizer) return color
  normalizer.fillStyle = '#000'
  normalizer.fillStyle = color
  const parsed = String(normalizer.fillStyle)
  if (SRGB.test(parsed)) return parsed
  normalizer.clearRect(0, 0, 1, 1)
  normalizer.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = normalizer.getImageData(0, 0, 1, 1).data
  if (a === 255) return `#${[r, g, b].map((v) => v!.toString(16).padStart(2, '0')).join('')}`
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a! / 255) * 1000) / 1000})`
}
