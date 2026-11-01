import type { Painter } from './painter'

/*
 * A painter that writes SVG instead of pixels. The chart draws into it
 * with the same code it draws onto the canvas, so an exported or
 * server-rendered SVG looks the same as the chart in the page.
 */

const TAU = Math.PI * 2

/** A number with at most two decimals, short in the markup. */
export const num = (value: number) => String(Math.round(value * 100) / 100)

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Text made safe to put in markup, as content or in an attribute. */
export const escapeXml = (text: string) => text.replace(/[&<>"']/g, (c) => ESCAPES[c]!)

/** `name="value"` for a color, or a style when SVG attributes can't take it (`var(…)`, `color-mix(…)`). */
export function paintAttribute(name: 'fill' | 'stroke' | 'stop-color', color: string): string {
  return /^(var|color-mix)\(/.test(color)
    ? ` style="${name}:${escapeXml(color)}"`
    : ` ${name}="${escapeXml(color)}"`
}

interface State {
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  lineJoin: CanvasLineJoin
  lineCap: CanvasLineCap
  globalAlpha: number
  dash: number[]
  clip: string | null
}

export class SvgPainter implements Painter {
  fillStyle: string | CanvasGradient | CanvasPattern = '#000'
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000'
  lineWidth = 1
  lineJoin: CanvasLineJoin = 'miter'
  lineCap: CanvasLineCap = 'butt'
  globalAlpha = 1

  private dash: number[] = []
  private clipId: string | null = null
  private states: State[] = []
  private path = ''
  /** The current point, and where the current subpath starts; `NaN` when there is none. */
  private cx = Number.NaN
  private cy = Number.NaN
  private sx = Number.NaN
  private sy = Number.NaN
  private body: string[] = []
  private defs: string[] = []
  private clips = 0
  private ids = 0

  /**
   * `prefix` starts every id the markup gives, so two SVGs in one page
   * don't share them; `color` turns a color into one the SVG's reader
   * understands.
   */
  constructor(
    private prefix: string,
    private color: (css: string) => string = (css) => css,
  ) {}

  /** An id of its own in this SVG, for something drawn as raw markup (a gradient). */
  id(name: string): string {
    return `${this.prefix}${name}${this.ids++}`
  }

  save(): void {
    this.states.push({
      fillStyle: String(this.fillStyle),
      strokeStyle: String(this.strokeStyle),
      lineWidth: this.lineWidth,
      lineJoin: this.lineJoin,
      lineCap: this.lineCap,
      globalAlpha: this.globalAlpha,
      dash: this.dash,
      clip: this.clipId,
    })
  }

  restore(): void {
    const state = this.states.pop()
    if (!state) return
    this.fillStyle = state.fillStyle
    this.strokeStyle = state.strokeStyle
    this.lineWidth = state.lineWidth
    this.lineJoin = state.lineJoin
    this.lineCap = state.lineCap
    this.globalAlpha = state.globalAlpha
    this.dash = state.dash
    this.clipId = state.clip
  }

  beginPath(): void {
    this.path = ''
    this.cx = this.cy = this.sx = this.sy = Number.NaN
  }

  closePath(): void {
    if (!this.path) return
    this.path += 'Z'
    this.cx = this.sx
    this.cy = this.sy
  }

  moveTo(x: number, y: number): void {
    this.path += `M${num(x)} ${num(y)}`
    this.cx = this.sx = x
    this.cy = this.sy = y
  }

  lineTo(x: number, y: number): void {
    // a line with no point before it starts there, as on a canvas
    if (this.cx !== this.cx) return this.moveTo(x, y)
    this.path += `L${num(x)} ${num(y)}`
    this.cx = x
    this.cy = y
  }

  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void {
    if (this.cx !== this.cx) this.moveTo(c1x, c1y)
    this.path += `C${num(c1x)} ${num(c1y)} ${num(c2x)} ${num(c2y)} ${num(x)} ${num(y)}`
    this.cx = x
    this.cy = y
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.path += `M${num(x)} ${num(y)}h${num(width)}v${num(height)}h${num(-width)}Z`
    this.cx = this.sx = x
    this.cy = this.sy = y
  }

  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise = false,
  ): void {
    const r = Math.abs(radius)
    const start: [number, number] = [x + r * Math.cos(startAngle), y + r * Math.sin(startAngle)]
    // a canvas draws a line from the current point to where the arc starts
    if (this.cx !== this.cx) this.moveTo(start[0], start[1])
    else this.lineTo(start[0], start[1])
    if (r === 0) return
    let sweep = counterclockwise ? startAngle - endAngle : endAngle - startAngle
    const whole = sweep >= TAU
    sweep = whole ? TAU : ((sweep % TAU) + TAU) % TAU
    if (sweep === 0) return
    const flag = counterclockwise ? 0 : 1
    const end = startAngle + (counterclockwise ? -sweep : sweep)
    const point = (angle: number) =>
      `${num(x + r * Math.cos(angle))} ${num(y + r * Math.sin(angle))}`
    if (whole) {
      // a whole circle is two halves: one arc can't end where it starts
      const half = startAngle + (counterclockwise ? -Math.PI : Math.PI)
      this.path += `A${num(r)} ${num(r)} 0 0 ${flag} ${point(half)}`
      this.path += `A${num(r)} ${num(r)} 0 0 ${flag} ${point(end)}`
    } else {
      this.path += `A${num(r)} ${num(r)} 0 ${sweep > Math.PI ? 1 : 0} ${flag} ${point(end)}`
    }
    this.cx = x + r * Math.cos(end)
    this.cy = y + r * Math.sin(end)
  }

  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void {
    if (this.cx !== this.cx) return this.moveTo(x1, y1)
    const [x0, y0] = [this.cx, this.cy]
    const ax = x0 - x1
    const ay = y0 - y1
    const bx = x2 - x1
    const by = y2 - y1
    const la = Math.hypot(ax, ay)
    const lb = Math.hypot(bx, by)
    const cross = ax * by - ay * bx
    // no corner to round: a straight line to the corner point
    if (radius <= 0 || la === 0 || lb === 0 || Math.abs(cross) < 1e-9 * la * lb)
      return this.lineTo(x1, y1)
    const angle = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb))))
    const along = radius / Math.tan(angle / 2)
    this.lineTo(x1 + (ax / la) * along, y1 + (ay / la) * along)
    const ex = x1 + (bx / lb) * along
    const ey = y1 + (by / lb) * along
    this.path += `A${num(radius)} ${num(radius)} 0 0 ${cross < 0 ? 1 : 0} ${num(ex)} ${num(ey)}`
    this.cx = ex
    this.cy = ey
  }

  setLineDash(segments: Iterable<number>): void {
    this.dash = [...segments]
  }

  fill(rule?: CanvasFillRule | Path2D): void {
    if (!this.path) return
    const evenodd = rule === 'evenodd' ? ' fill-rule="evenodd"' : ''
    this.body.push(
      `<path d="${this.path}"${paintAttribute('fill', this.color(String(this.fillStyle)))}${evenodd}${this.common()}/>`,
    )
  }

  stroke(): void {
    if (!this.path || this.lineWidth <= 0) return
    let attributes = ` fill="none"${paintAttribute('stroke', this.color(String(this.strokeStyle)))}`
    if (this.lineWidth !== 1) attributes += ` stroke-width="${num(this.lineWidth)}"`
    if (this.lineJoin !== 'miter') attributes += ` stroke-linejoin="${this.lineJoin}"`
    // a canvas cuts miters off later than SVG does by default
    else attributes += ' stroke-miterlimit="10"'
    if (this.lineCap !== 'butt') attributes += ` stroke-linecap="${this.lineCap}"`
    if (this.dash.length) attributes += ` stroke-dasharray="${this.dash.map(num).join(' ')}"`
    this.body.push(`<path d="${this.path}"${attributes}${this.common()}/>`)
  }

  clip(): void {
    const id = `${this.prefix}c${this.clips++}`
    const within = this.clipId ? ` clip-path="url(#${this.clipId})"` : ''
    this.defs.push(`<clipPath id="${id}"${within}><path d="${this.path || 'M0 0'}"/></clipPath>`)
    this.clipId = id
  }

  drawImage(image: CanvasImageSource, ...args: number[]): void {
    let href = ''
    if (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement)
      href = image.toDataURL('image/png')
    else if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement)
      href = image.currentSrc || image.src
    if (!href) return
    const size = image as { width: number; height: number }
    // only where it goes: a part of the image (nine numbers) is drawn whole
    const [x = 0, y = 0, width = size.width, height = size.height] =
      args.length >= 8 ? args.slice(4) : args
    this.body.push(
      `<image href="${escapeXml(href)}" x="${num(x)}" y="${num(y)}" width="${num(width)}" height="${num(height)}" preserveAspectRatio="none"${this.common()}/>`,
    )
  }

  /** Draws what `draw` paints as one layer, `alpha` see-through as a whole. */
  layer(alpha: number, draw: () => void): void {
    this.body.push(`<g opacity="${num(alpha)}">`)
    draw()
    this.body.push('</g>')
  }

  /** Adds markup as it is, for what the painter can't draw (text). */
  raw(markup: string): void {
    this.body.push(markup)
  }

  /** The clip and see-through every shape takes from the state. */
  private common(): string {
    let attributes = ''
    if (this.globalAlpha < 1) attributes += ` opacity="${num(this.globalAlpha)}"`
    if (this.clipId) attributes += ` clip-path="url(#${this.clipId})"`
    return attributes
  }

  /** What was drawn, as the inside of an `<svg>`. */
  markup(): string {
    const defs = this.defs.length ? `<defs>${this.defs.join('')}</defs>` : ''
    return defs + this.body.join('')
  }
}

/** Whether a painter writes SVG: it then draws layers and text itself. */
export const isSvg = (painter: unknown): painter is SvgPainter => painter instanceof SvgPainter
