import { h, render, type Component } from 'vue'
import type { PortAnchor } from '../context'
import type { Rect } from '../core/model'
import type { FlowMessages } from '../locale'
import { plainColor } from './color'

export interface FlowDrawTextOptions {
  /** In px; the editor's font size by default. */
  size?: number
  /** A CSS font weight, e.g. `500`. */
  weight?: string | number
  /** Line height in px; 1.5 times the size by default. */
  lineHeight?: number
  color?: string
  align?: 'start' | 'center' | 'end'
  /** Where the lines sit in the box when they take less than its height. */
  valign?: 'top' | 'middle'
  /** Keeps it to one line, cut with an ellipsis. */
  nowrap?: boolean
}

/**
 * What a node type's `draw` gets to draw a node as SVG, for `exportSVG` and
 * `exportPNG`. Coordinates are the node's own: `0, 0` is its top left.
 */
export interface FlowDrawContext {
  /** The node's size. */
  width: number
  height: number
  /** Its ports where they are on screen, relative to its top left. */
  ports: ReadonlyMap<string, PortAnchor>
  /**
   * A port as the editor draws it, where it is on screen: its ring or shape
   * in its type's color, filled once connected. Empty for a port not shown.
   */
  port: (id: string) => string
  /** The editor's current strings. */
  messages: FlowMessages
  /**
   * The computed style of an element made with these classes, outermost
   * first, inside the editor so its theme and variables apply. Pass colors
   * read from it through `color`.
   */
  style: (...classes: string[]) => CSSStyleDeclaration
  /**
   * A CSS color, also one with variables such as `var(--dou-color-text)`,
   * as `#rrggbb` or `rgba(…)`, which every SVG reader understands.
   */
  color: (value: string) => string
  /** Text in a box, wrapped as on screen and cut where the box ends. */
  text: (value: string, box: Rect, options?: FlowDrawTextOptions) => string
  /** An icon component, e.g. from `@dou-ui/icons`, as SVG. */
  icon: (icon: Component, box: Rect, color: string) => string
  /** An image; in a PNG it is embedded when its address can be read. */
  image: (src: string, box: Rect, options?: { radius?: number }) => string
  /** Escapes text for SVG markup. */
  escape: (text: string) => string
}

export const escapeXml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // control characters other than tab and new line aren't allowed in XML
    // oxlint-disable-next-line no-control-regex -- strips them
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

export const round = (value: number) => Math.round(value * 100) / 100

/** Characters a line may break after, as CSS breaks Chinese, Japanese and Korean text. */
const WIDE = /[⺀-鿿가-힯豈-﫿︰-﹏＀-￯]/
const TOKENS = /[⺀-鿿가-힯豈-﫿︰-﹏＀-￯]|[^\s⺀-鿿가-힯豈-﫿︰-﹏＀-￯]+\s*|\s+/g

/**
 * Lines of text that fit `max`: breaks between words and between wide
 * characters, inside a word only when it alone is too long, and at new lines.
 */
export function wrapText(text: string, max: number, measure: (text: string) => number): string[] {
  const out: string[] = []
  const breakLong = (word: string) => {
    let line = ''
    for (const char of word) {
      if (line && measure(line + char) > max) {
        out.push(line)
        line = ''
      }
      line += char
    }
    return line
  }
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const token of paragraph.match(TOKENS) ?? []) {
      const next = line + token
      if (!line.trim() || measure(next.trimEnd()) <= max) {
        line = next
        if (measure(line.trimEnd()) > max) line = breakLong(line.trimEnd())
        continue
      }
      out.push(line.trimEnd())
      line = WIDE.test(token) ? token : token.trimStart()
      if (measure(line.trimEnd()) > max) line = breakLong(line.trimEnd())
    }
    out.push(line.trimEnd())
  }
  return out
}

/** Cuts text to fit `max`, with an ellipsis. */
export function cutText(text: string, max: number, measure: (text: string) => number) {
  if (measure(text) <= max) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (measure(`${text.slice(0, mid)}…`) <= max) lo = mid
    else hi = mid - 1
  }
  return lo ? `${text.slice(0, lo)}…` : ''
}

export interface DrawTools {
  /** Makes the context for one node. */
  forNode: (
    size: { width: number; height: number },
    ports: ReadonlyMap<string, PortAnchor>,
    port: (id: string) => string,
  ) => FlowDrawContext
  style: FlowDrawContext['style']
  color: FlowDrawContext['color']
  text: FlowDrawContext['text']
  measure: (text: string, size: number, weight?: string | number) => number
  fontFamily: string
  fontSize: number
  /** Image addresses the drawing used. */
  images: Set<string>
  dispose: () => void
}

/**
 * The tools a drawing needs, reading the page inside `root`: styles from
 * elements made in a hidden box there, text measured with the editor's font.
 * `imageHref` turns an image address into the one written out.
 */
export function drawTools(
  root: HTMLElement,
  messages: FlowMessages,
  imageHref: (src: string) => string | null = (src) => src,
): DrawTools {
  const box = document.createElement('div')
  box.setAttribute('aria-hidden', 'true')
  box.style.cssText =
    'position:absolute;top:0;left:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none'
  root.append(box)
  const rootStyle = getComputedStyle(root)
  const fontFamily = rootStyle.fontFamily || 'sans-serif'
  const fontSize = Number.parseFloat(rootStyle.fontSize) || 14

  const styles = new Map<string, CSSStyleDeclaration>()
  const style = (...classes: string[]) => {
    const key = classes.join('\n')
    let found = styles.get(key)
    if (!found) {
      let parent: HTMLElement = box
      for (const name of classes) {
        const el = document.createElement('div')
        el.className = name
        parent.append(el)
        parent = el
      }
      found = getComputedStyle(parent)
      styles.set(key, found)
    }
    return found
  }

  const colors = new Map<string, string>()
  const swatch = document.createElement('div')
  box.append(swatch)
  const color = (value: string) => {
    let found = colors.get(value)
    if (found === undefined) {
      swatch.style.color = ''
      swatch.style.color = value
      found = plainColor(getComputedStyle(swatch).color || value)
      colors.set(value, found)
    }
    return found
  }

  let pen: CanvasRenderingContext2D | null | undefined
  const widths = new Map<string, number>()
  const measure = (text: string, size: number, weight: string | number = 400) => {
    const font = `${weight} ${size}px ${fontFamily}`
    const key = `${font}\n${text}`
    let width = widths.get(key)
    if (width !== undefined) return width
    if (pen === undefined)
      try {
        pen = document.createElement('canvas').getContext('2d')
      } catch {
        pen = null
      }
    if (pen) {
      pen.font = font
      width = pen.measureText(text).width
    } else {
      // without a canvas, e.g. in tests: wide characters are square, others half
      width = 0
      for (const char of text) width += WIDE.test(char) ? size : size * 0.55
    }
    widths.set(key, width)
    return width
  }

  /** Where the baseline goes to centre a line of `size` in its line box. */
  const baselineOffset = (size: number) => {
    if (pen) {
      pen.font = `400 ${size}px ${fontFamily}`
      const m = pen.measureText('中Hg')
      if (m.fontBoundingBoxAscent) return (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2
    }
    return size * 0.35
  }

  const text: FlowDrawContext['text'] = (value, area, options = {}) => {
    if (!value) return ''
    const size = options.size ?? fontSize
    const weight = options.weight ?? 400
    const lineHeight = options.lineHeight ?? size * 1.5
    const width = (line: string) => measure(line, size, weight)
    let lines = options.nowrap
      ? [cutText(value.replace(/\s+/g, ' '), area.width, width)]
      : wrapText(value, area.width, width)
    // whole lines that fit, as the box clips them on screen
    const room = Math.max(1, Math.floor((area.height + 0.5) / lineHeight))
    if (lines.length > room) lines = lines.slice(0, room)
    const total = lines.length * lineHeight
    const top = options.valign === 'middle' ? area.y + (area.height - total) / 2 : area.y
    const align = options.align ?? 'start'
    const x =
      align === 'center' ? area.x + area.width / 2 : align === 'end' ? area.x + area.width : area.x
    const anchor = align === 'center' ? 'middle' : align === 'end' ? 'end' : 'start'
    const shift = baselineOffset(size)
    const fill = options.color ? ` fill="${options.color}"` : ''
    const bold = weight === 400 || weight === '400' ? '' : ` font-weight="${weight}"`
    const spans = lines
      .map((line, i) =>
        line
          ? `<tspan x="${round(x)}" y="${round(top + lineHeight * i + lineHeight / 2 + shift)}">${escapeXml(line)}</tspan>`
          : '',
      )
      .join('')
    return spans
      ? `<text font-size="${round(size)}"${bold}${fill} text-anchor="${anchor}" xml:space="preserve">${spans}</text>`
      : ''
  }

  const holder = document.createElement('div')
  const icons = new Map<Component, string>()
  const icon: FlowDrawContext['icon'] = (component, area, fill) => {
    let markup = icons.get(component)
    if (markup === undefined) {
      try {
        render(h(component), holder)
        markup = holder.querySelector('svg')?.outerHTML ?? ''
      } catch {
        markup = ''
      }
      render(null, holder)
      icons.set(component, markup)
    }
    if (!markup) return ''
    const svg = markup
      .replace(/^<svg\b([^>]*)>/, (_, attrs: string) => {
        const kept = attrs.replace(/\s(width|height|x|y|class|style|aria-[\w-]+|role)="[^"]*"/g, '')
        return `<svg${kept} x="${round(area.x)}" y="${round(area.y)}" width="${round(area.width)}" height="${round(area.height)}">`
      })
      .replace(/currentColor/g, fill)
    return svg
  }

  const images = new Set<string>()
  let clips = 0
  const image: FlowDrawContext['image'] = (src, area, options = {}) => {
    images.add(src)
    const href = imageHref(src)
    const { x, y, width, height } = area
    if (href === null)
      // not readable here: a plain box where it would be
      return `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" rx="${options.radius ?? 0}" fill="${color('var(--dou-color-bg-muted)')}"/>`
    let clip = ''
    let defs = ''
    if (options.radius) {
      const id = `dou-flow-clip-${++clips}`
      defs = `<clipPath id="${id}"><rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" rx="${options.radius}"/></clipPath>`
      clip = ` clip-path="url(#${id})"`
    }
    return `${defs}<image href="${escapeXml(href)}" x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" preserveAspectRatio="xMidYMid meet"${clip}/>`
  }

  return {
    forNode: (size, ports, port) => ({
      width: size.width,
      height: size.height,
      ports,
      port,
      messages,
      style,
      color,
      text,
      icon,
      image,
      escape: escapeXml,
    }),
    style,
    color,
    text,
    measure,
    fontFamily,
    fontSize,
    images,
    dispose: () => box.remove(),
  }
}
