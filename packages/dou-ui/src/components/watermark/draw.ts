export interface MarkOptions {
  lines: string[]
  image?: HTMLImageElement
  width?: number
  height?: number
  rotate: number
  gap: [number, number]
  staggered: boolean
  font: string
  fontSize: number
}

export interface Tile {
  url: string
  /** The size of one repeat, in CSS px. */
  width: number
  height: number
}

const LINE_HEIGHT = 1.5

/**
 * Draw one repeat of the pattern. Marks are drawn in solid black: text
 * becomes a mask, so the layer can take its color from CSS and follow the
 * theme. Each mark is also drawn shifted by one repeat in every direction,
 * so a rotated mark that crosses the edge continues on the other side.
 */
export function drawTile(options: MarkOptions): Tile | null {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.font = options.font
  const measured = options.lines.length
    ? Math.max(...options.lines.map((line) => ctx.measureText(line).width))
    : 0
  const markWidth = Math.ceil(options.width ?? (options.image ? 120 : measured))
  const markHeight = Math.ceil(
    options.height ??
      (options.image ? 64 : options.lines.length * options.fontSize * LINE_HEIGHT),
  )

  const width = markWidth + options.gap[0]
  const height = (markHeight + options.gap[1]) * (options.staggered ? 2 : 1)
  const ratio = Math.max(1, globalThis.devicePixelRatio || 1)
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  ctx.scale(ratio, ratio)

  const centers: Array<[number, number]> = options.staggered
    ? [
        [width / 2, height / 4],
        [0, (height * 3) / 4],
      ]
    : [[width / 2, height / 2]]

  for (const [cx, cy] of centers) {
    for (const dx of [-width, 0, width]) {
      for (const dy of [-height, 0, height]) {
        ctx.save()
        ctx.translate(cx + dx, cy + dy)
        ctx.rotate((options.rotate * Math.PI) / 180)
        if (options.image) {
          ctx.drawImage(options.image, -markWidth / 2, -markHeight / 2, markWidth, markHeight)
        } else {
          ctx.font = options.font
          ctx.fillStyle = '#000'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const lineHeight = options.fontSize * LINE_HEIGHT
          const top = -((options.lines.length - 1) * lineHeight) / 2
          options.lines.forEach((line, index) => ctx.fillText(line, 0, top + index * lineHeight))
        }
        ctx.restore()
      }
    }
  }

  return { url: canvas.toDataURL(), width, height }
}
