import type { Painter, Rect } from './painter'

/*
 * Patterns over a fill, so series and slices can be told apart without
 * their colors: in print, in grays, or for eyes that see the colors alike.
 * A pattern is drawn as lines (or dots) over the shape, clipped to it.
 */

export type ChartPattern =
  'diagonal' | 'dots' | 'crosshatch' | 'horizontal' | 'backslash' | 'grid' | 'vertical'

/** The patterns in the order series and slices take them. */
export const CHART_PATTERNS: readonly ChartPattern[] = [
  'diagonal',
  'dots',
  'crosshatch',
  'horizontal',
  'backslash',
  'grid',
  'vertical',
]

/** The room between lines (and dots), in px. */
const STEP = 6

/**
 * Draws `pattern` over `box` in `ink`, clipped to the current path: call
 * it right after filling a shape, while its path is still the current one.
 */
export function fillPattern(
  painter: Painter,
  pattern: ChartPattern,
  box: Rect,
  ink: string,
  alpha = 0.6,
) {
  if (!(box.width > 0) || !(box.height > 0)) return
  painter.save()
  painter.clip()
  painter.globalAlpha *= alpha
  painter.strokeStyle = ink
  painter.fillStyle = ink
  painter.lineWidth = 1.25
  painter.lineCap = 'butt'
  painter.setLineDash([])
  // lines on a grid fixed to the chart, so neighboring shapes line up
  const x0 = Math.floor(box.x / STEP) * STEP
  const y0 = Math.floor(box.y / STEP) * STEP
  const x1 = box.x + box.width
  const y1 = box.y + box.height
  painter.beginPath()
  const lines = (dx: number, dy: number) => {
    // lines across the box at an angle: `dx` across for every `dy` down
    const span = x1 - x0 + (y1 - y0)
    for (let k = -span; k <= span; k += STEP) {
      if (dy === 0) {
        painter.moveTo(x0, y0 + k + STEP / 2)
        painter.lineTo(x1, y0 + k + STEP / 2)
      } else if (dx === 0) {
        painter.moveTo(x0 + k + STEP / 2, y0)
        painter.lineTo(x0 + k + STEP / 2, y1)
      } else {
        painter.moveTo(x0 + k, y0)
        painter.lineTo(x0 + k + (dx / dy) * (y1 - y0), y1)
      }
    }
  }
  switch (pattern) {
    case 'diagonal':
      lines(-1, 1)
      break
    case 'backslash':
      lines(1, 1)
      break
    case 'horizontal':
      lines(1, 0)
      break
    case 'vertical':
      lines(0, 1)
      break
    case 'crosshatch':
      lines(-1, 1)
      lines(1, 1)
      break
    case 'grid':
      lines(1, 0)
      lines(0, 1)
      break
    case 'dots': {
      const r = 1.1
      for (let y = y0 + STEP / 2; y < y1 + STEP; y += STEP)
        for (let x = x0 + STEP / 2; x < x1 + STEP; x += STEP) {
          // every other row shifted half a step, so the dots don't line up in columns
          const u = x + ((Math.round((y - y0) / STEP) % 2) * STEP) / 2
          painter.moveTo(u + r, y)
          painter.arc(u, y, r, 0, Math.PI * 2)
        }
      painter.fill()
      painter.restore()
      return
    }
  }
  painter.stroke()
  painter.restore()
}

/** The same pattern for a legend swatch, as a CSS background image and its size. */
export function patternCss(pattern: ChartPattern, ink: string): { image: string; size?: string } {
  return pattern === 'dots'
    ? { image: `radial-gradient(${ink} 0.75px, transparent 1px)`, size: '3px 3px' }
    : { image: linesCss(pattern, ink) }
}

function linesCss(pattern: Exclude<ChartPattern, 'dots'>, ink: string): string {
  const line = (angle: number) =>
    `repeating-linear-gradient(${angle}deg, ${ink} 0 1px, transparent 1px 3px)`
  switch (pattern) {
    // the stripes of a gradient run across its angle: 135deg makes them lean like /
    case 'diagonal':
      return line(135)
    case 'backslash':
      return line(45)
    case 'horizontal':
      return line(0)
    case 'vertical':
      return line(90)
    case 'crosshatch':
      return `${line(45)}, ${line(-45)}`
    case 'grid':
      return `${line(0)}, ${line(90)}`
  }
}
