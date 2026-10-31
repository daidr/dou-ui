import type { CSSProperties } from 'vue'
import type { PortAnchor } from '../context'
import type { EdgeRoute } from '../core/edge-types'
import type { FlowEdge, FlowNode, Rect } from '../core/model'
import type { NodeTypeSpec } from '../core/node-types'
import { escapeXml, round, type DrawTools, type FlowDrawContext } from './context'

export interface FlowExportOptions {
  /**
   * `all` (the default): every node and edge. `view`: what is in view now,
   * at the canvas's size, cut at its edges. `selection`: the selected nodes,
   * what is inside selected groups, and the edges between them; it throws
   * when nothing is selected.
   */
  range?: 'all' | 'view' | 'selection'
  /** Room around the drawing, in px. Defaults to `24`; not used by `view`. */
  padding?: number
  /** Fills the canvas color behind it. Defaults to `true`; `false` leaves it see-through. */
  background?: boolean
}

export interface FlowImageOptions extends FlowExportOptions {
  /** Pixels per CSS pixel. Defaults to `2`, sharp on most screens and in print. */
  pixelRatio?: number
}

export interface DrawNode {
  node: FlowNode
  spec: NodeTypeSpec
  rect: Rect
  ports: ReadonlyMap<string, PortAnchor>
  container: boolean
  label: string
  /** Draws one of its ports, as `FlowDrawContext.port`. */
  port: (id: string) => string
}

export interface DrawEdge {
  edge: FlowEdge
  type: string
  route: EdgeRoute
  style?: CSSProperties
  stale: boolean
}

export interface DrawInput {
  /** Containers outer first, then the other nodes lowest first. */
  nodes: DrawNode[]
  edges: DrawEdge[]
  padding: number
  background: boolean
  /** The area to draw, in place of what the drawing covers plus `padding`. */
  frame?: Rect
  /** Extensions' layers over the nodes, as `FlowExtension.drawLayer`. */
  layers?: ((draw: FlowDrawContext) => string)[]
}

/** The points a path passes through or bends towards; the curve stays inside them. */
function pathPoints(path: string) {
  const numbers = path.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) ?? []
  const out: { x: number; y: number }[] = []
  for (let i = 0; i + 1 < numbers.length; i += 2) out.push({ x: numbers[i]!, y: numbers[i + 1]! })
  return out
}

/** A box that grows to hold what is added. */
function extent() {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  return {
    add(rect: Rect) {
      minX = Math.min(minX, rect.x)
      minY = Math.min(minY, rect.y)
      maxX = Math.max(maxX, rect.x + rect.width)
      maxY = Math.max(maxY, rect.y + rect.height)
    },
    get(): Rect | null {
      return minX === Infinity
        ? null
        : { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    },
  }
}

const px = (value: string, fallback = 0) => {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}

/** A card like the editor's frame: border, background and radius. */
export function drawCard(draw: FlowDrawContext, classes: string[] = []): string {
  const s = draw.style(['dou-flow-editor__node', ...classes].join(' '))
  const border = px(s.borderTopWidth, 1)
  const radius = px(s.borderTopLeftRadius, 8)
  const inset = border / 2
  return `<rect x="${inset}" y="${inset}" width="${round(Math.max(0, draw.width - border))}" height="${round(Math.max(0, draw.height - border))}" rx="${round(Math.max(0, radius - inset))}" fill="${draw.color(s.backgroundColor)}" stroke="${draw.color(s.borderTopColor)}" stroke-width="${border}"/>`
}

/** What a node type without `draw` is drawn as: its card, its name and its ports. */
export function drawFallback(draw: FlowDrawContext, label: string, framed: boolean): string {
  const parts = framed ? [drawCard(draw)] : []
  for (const id of draw.ports.keys()) parts.push(draw.port(id))
  parts.push(
    draw.text(
      label,
      { x: 12, y: 0, width: Math.max(0, draw.width - 24), height: draw.height },
      { align: 'center', valign: 'middle', color: draw.color('var(--dou-color-text)') },
    ),
  )
  return parts.join('')
}

/** The edges' look, read from paths made like the editor's. */
function edgeLook(tools: DrawTools, root: HTMLElement) {
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('class', 'dou-flow-editor__edges')
  svg.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'
  root.append(svg)
  const looks = new Map<string, string>()
  return {
    of(item: DrawEdge) {
      const style = item.style as Record<string, string | undefined> | undefined
      const key = [item.type, item.stale, item.edge.animated, JSON.stringify(style ?? {})].join('|')
      let found = looks.get(key)
      if (found === undefined) {
        const g = document.createElementNS(NS, 'g')
        g.setAttribute('data-edge-type', item.type)
        const path = document.createElementNS(NS, 'path')
        const classes = ['dou-flow-editor__edge']
        if (item.stale) classes.push('is-stale')
        if (item.edge.animated) classes.push('is-animated')
        path.setAttribute('class', classes.join(' '))
        for (const [name, value] of Object.entries(style ?? {})) {
          if (value === undefined) continue
          if (name.startsWith('--')) path.style.setProperty(name, value)
          else
            path.style.setProperty(
              name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
              value,
            )
        }
        g.append(path)
        svg.append(g)
        const s = getComputedStyle(path)
        const dash = s.strokeDasharray && s.strokeDasharray !== 'none' ? s.strokeDasharray : ''
        const width = px(s.strokeWidth, 1)
        found =
          `fill="none" stroke="${tools.color(s.stroke || 'var(--dou-flow-editor-edge)')}" stroke-width="${round(width)}"` +
          (dash ? ` stroke-dasharray="${dash.replace(/px/g, '').replace(/,\s*/g, ' ')}"` : '') +
          (s.strokeLinecap && s.strokeLinecap !== 'butt'
            ? ` stroke-linecap="${s.strokeLinecap}"`
            : '') +
          (s.strokeLinejoin && s.strokeLinejoin !== 'miter'
            ? ` stroke-linejoin="${s.strokeLinejoin}"`
            : '')
        looks.set(key, found)
      }
      return found
    },
    dispose: () => svg.remove(),
  }
}

/** An edge's label: a pill with its text, as on screen. */
function drawLabel(tools: DrawTools, text: string, at: { x: number; y: number }) {
  const s = tools.style('dou-flow-editor__label')
  const size = px(s.fontSize, 12)
  const padding = px(s.paddingLeft, 6)
  const border = px(s.borderTopWidth, 1)
  const height = px(s.lineHeight, 20) + border * 2
  const max = px(s.maxWidth, 200)
  const textWidth = Math.min(tools.measure(text, size), max - padding * 2 - border * 2)
  const width = Math.ceil(textWidth + padding * 2 + border * 2)
  const x = at.x - width / 2
  const y = at.y - height / 2
  const radius = px(s.borderTopLeftRadius, 6)
  const markup =
    `<rect x="${round(x + border / 2)}" y="${round(y + border / 2)}" width="${round(width - border)}" height="${round(height - border)}" rx="${round(radius)}" fill="${tools.color(s.backgroundColor)}" stroke="${tools.color(s.borderTopColor)}" stroke-width="${border}"/>` +
    tools.text(
      text,
      { x: x + border + padding, y, width: width - (border + padding) * 2, height },
      { size, lineHeight: height, color: tools.color(s.color), align: 'center', nowrap: true },
    )
  return { markup, box: { x, y, width, height } }
}

/**
 * The flow as an SVG document: containers, edges, edge labels, then the
 * other nodes, as the editor stacks them.
 */
export function drawFlow(input: DrawInput, tools: DrawTools, root: HTMLElement) {
  const bounds = extent()
  const nodeParts: string[] = []
  const containerParts: string[] = []
  for (const item of input.nodes) {
    const { node, spec, rect } = item
    bounds.add(spec.bounds?.(node, rect) ?? rect)
    const draw = tools.forNode({ width: rect.width, height: rect.height }, item.ports, item.port)
    let body: string
    try {
      body = spec.draw
        ? spec.draw(node as never, draw)
        : drawFallback(draw, item.label, spec.frame !== false)
    } catch (error) {
      console.error(`[@dou-ui/flow] drawing node "${node.id}" failed`, error)
      body = drawFallback(draw, item.label, true)
    }
    if (!body) continue
    const g = `<g transform="translate(${round(rect.x)} ${round(rect.y)})">${body}</g>`
    ;(item.container ? containerParts : nodeParts).push(g)
  }
  const looks = edgeLook(tools, root)
  const edgeParts: string[] = []
  const labelParts: string[] = []
  try {
    for (const item of input.edges) {
      for (const p of pathPoints(item.route.path))
        bounds.add({ x: p.x, y: p.y, width: 0, height: 0 })
      edgeParts.push(`<path d="${escapeXml(item.route.path)}" ${looks.of(item)}/>`)
      if (item.edge.label) {
        const label = drawLabel(tools, item.edge.label, item.route.label)
        labelParts.push(label.markup)
        bounds.add(label.box)
      }
    }
  } finally {
    looks.dispose()
  }
  const box = input.frame ?? bounds.get() ?? { x: 0, y: 0, width: 0, height: 0 }
  const pad = input.frame ? 0 : input.padding
  const x = Math.floor(box.x - pad)
  const y = Math.floor(box.y - pad)
  const width = Math.ceil(box.x + box.width + pad) - x
  const height = Math.ceil(box.y + box.height + pad) - y
  const layerParts: string[] = []
  if (input.layers?.length) {
    const draw = tools.forNode({ width, height }, new Map(), () => '')
    for (const layer of input.layers) {
      try {
        layerParts.push(layer(draw))
      } catch (error) {
        console.error('[@dou-ui/flow] drawing a layer failed', error)
      }
    }
  }
  const rootStyle = getComputedStyle(root)
  const background = input.background
    ? `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${tools.color(rootStyle.backgroundColor || 'var(--dou-color-bg-canvas)')}"/>`
    : ''
  const font = escapeXml(tools.fontFamily)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}" font-family="${font}" font-size="${round(tools.fontSize)}" fill="${tools.color('var(--dou-color-text)')}">` +
    background +
    containerParts.join('') +
    edgeParts.join('') +
    labelParts.join('') +
    nodeParts.join('') +
    layerParts.join('') +
    '</svg>'
  return { svg, width, height }
}

/** Reads an image into a data URL, or `null` when it can't be read from this page. */
export async function readImage(src: string): Promise<string | null> {
  if (src.startsWith('data:')) return src
  try {
    const response = await fetch(src)
    if (!response.ok) return null
    const blob = await response.blob()
    // e.g. a page in place of a missing file
    if (!blob.type.startsWith('image/')) return null
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.addEventListener('load', () => resolve(String(reader.result)))
      reader.addEventListener('error', () => resolve(null))
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** The largest canvas side most browsers draw. */
const MAX_SIDE = 16384
const MAX_AREA = 16384 * 16384 * 0.25

/** Paints an SVG document on a canvas and returns it as PNG. */
export async function svgToPng(svg: string, width: number, height: number, ratio: number) {
  // within what a canvas can hold
  ratio = Math.min(
    ratio,
    MAX_SIDE / Math.max(width, 1),
    MAX_SIDE / Math.max(height, 1),
    Math.sqrt(MAX_AREA / Math.max(width * height, 1)),
  )
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const sheet = document.createElement('canvas')
    sheet.width = Math.max(1, Math.round(width * ratio))
    sheet.height = Math.max(1, Math.round(height * ratio))
    const pen = sheet.getContext('2d')!
    pen.scale(ratio, ratio)
    pen.drawImage(image, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) =>
      sheet.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('[@dou-ui/flow] PNG export failed'))),
        'image/png',
      ),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export type { FlowDrawContext }
