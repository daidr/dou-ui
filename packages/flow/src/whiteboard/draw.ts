import type { FlowNode } from '../core/model'
import type { FlowDrawContext } from '../export/context'
import {
  isNoneColor,
  resolveFillColor,
  resolveStrokeColor,
  resolveTextColor,
  type WhiteboardColor,
  type WhiteboardFill,
  type WhiteboardStroke,
} from './colors'
import { fitInk, inkOutline, INK_SIZE, unpack } from './ink'
import type { WhiteboardNodeData, WhiteboardShape } from './model'

const px = (value: string, fallback: number) => {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}
const r = (value: number) => Math.round(value * 100) / 100

/** A board node as SVG, as `board-node.vue` draws it. */
export function drawBoardNode(node: FlowNode<WhiteboardNodeData>, draw: FlowDrawContext): string {
  const data = (node.data ?? {}) as WhiteboardNodeData & {
    shape?: WhiteboardShape
    text?: string
    tone?: string
    fill?: WhiteboardFill
    stroke?: WhiteboardStroke
    textColor?: WhiteboardColor
    color?: WhiteboardColor
    points?: number[]
    box?: [number, number]
    size?: number
    src?: string
  }
  const kind = node.type === 'shape' || !node.type ? 'shape' : node.type
  const tone = data.tone ?? (kind === 'sticky' ? 'warning' : 'neutral')
  const shape = data.shape ?? 'rect'
  const nodeClass = `dou-whiteboard-node is-${kind}${kind === 'shape' ? ` is-${shape}` : ''} is-${tone}`
  const { width: w, height: h } = draw
  const parts: string[] = []

  if (kind === 'shape') {
    const s = draw.style(nodeClass, 'dou-whiteboard-node__shape')
    const borderless = isNoneColor(data.stroke)
    const customFill = resolveFillColor(data.fill, 'shape')
    const fill =
      customFill === 'none' ? 'none' : customFill ? draw.color(customFill) : draw.color(s.fill)
    const strokeWidth = borderless ? 0 : px(s.strokeWidth, 1.5)
    const i = strokeWidth / 2
    const diamondInset = borderless ? 0 : 1
    if (!borderless || fill !== 'none') {
      const customStroke = borderless ? undefined : resolveStrokeColor(data.stroke)
      const paint = borderless
        ? `fill="${fill}" stroke="none"`
        : `fill="${fill}" stroke="${customStroke ? draw.color(customStroke) : draw.color(s.stroke)}" stroke-width="${strokeWidth}" stroke-linejoin="round"`
      if (shape === 'ellipse')
        parts.push(
          `<ellipse cx="${r(w / 2)}" cy="${r(h / 2)}" rx="${r(Math.max(0, w / 2 - i))}" ry="${r(Math.max(0, h / 2 - i))}" ${paint}/>`,
        )
      else if (shape === 'diamond')
        parts.push(
          `<polygon points="${r(w / 2)},${diamondInset} ${r(w - diamondInset)},${r(h / 2)} ${r(w / 2)},${r(h - diamondInset)} ${diamondInset},${r(h / 2)}" ${paint}/>`,
        )
      else
        parts.push(
          `<rect x="${i}" y="${i}" width="${r(Math.max(0, w - strokeWidth))}" height="${r(Math.max(0, h - strokeWidth))}" rx="8" ${paint}/>`,
        )
    }
  } else if (kind === 'sticky') {
    const s = draw.style(nodeClass)
    const customFill = resolveFillColor(data.fill, 'sticky')
    if (customFill !== 'none') {
      const fill = customFill ? draw.color(customFill) : draw.color(s.backgroundColor)
      parts.push(
        `<rect width="${r(w)}" height="${r(h)}" rx="${px(s.borderTopLeftRadius, 4)}" fill="${fill}"/>`,
      )
    }
  } else if (kind === 'ink' && data.points && data.box) {
    const s = draw.style(nodeClass, 'dou-whiteboard-node__ink')
    const size = data.size ?? INK_SIZE
    const d = inkOutline(fitInk(unpack(data.points), data.box, w, h, size), size)
    const customStroke = resolveStrokeColor(data.color)
    const fill =
      customStroke && customStroke !== 'none' ? draw.color(customStroke) : draw.color(s.fill)
    parts.push(`<path d="${d}" fill="${fill}"/>`)
  } else if (kind === 'image' && data.src) {
    const s = draw.style(nodeClass, 'dou-whiteboard-node__image')
    parts.push(
      draw.image(
        data.src,
        { x: 0, y: 0, width: w, height: h },
        { radius: px(s.borderTopLeftRadius, 4) },
      ),
    )
  }

  if (data.text && (kind === 'shape' || kind === 'sticky' || kind === 'text')) {
    const s = draw.style(nodeClass, 'dou-whiteboard-node__text')
    const size = px(s.fontSize, 14)
    const top = px(s.paddingTop, 12)
    const side = px(s.paddingLeft, 16)
    const lineHeight = px(s.lineHeight, size * 1.5)
    const centred = kind !== 'text'
    const customText = resolveTextColor(kind === 'text' ? data.color : data.textColor)
    const color = customText ? draw.color(customText) : draw.color(draw.style(nodeClass).color)
    parts.push(
      draw.text(
        data.text,
        { x: side, y: top, width: Math.max(0, w - side * 2), height: Math.max(0, h - top * 2) },
        {
          size,
          lineHeight,
          color,
          align: centred ? 'center' : 'start',
          valign: centred ? 'middle' : 'top',
        },
      ),
    )
  }

  const body = parts.join('')
  const rotation = data.rotation
  return rotation ? `<g transform="rotate(${rotation} ${r(w / 2)} ${r(h / 2)})">${body}</g>` : body
}
