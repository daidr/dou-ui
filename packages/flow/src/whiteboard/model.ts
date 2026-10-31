import type { Tone } from 'dou-ui'
import type { FlowPortSpec } from '../core/model'

/** What a press on the board does. */
export type WhiteboardTool =
  'select' | 'hand' | 'rect' | 'ellipse' | 'diamond' | 'sticky' | 'text' | 'pen' | 'eraser'

/** The tools that put down a node with a box. */
export type WhiteboardShapeTool = Exclude<WhiteboardTool, 'select' | 'hand' | 'pen' | 'eraser'>

export type WhiteboardShape = 'rect' | 'ellipse' | 'diamond'

/** What every board node can carry. */
export interface WhiteboardNodeData {
  [key: string]: unknown
  /** Degrees clockwise around the node's centre. */
  rotation?: number
}

export interface WhiteboardShapeData extends WhiteboardNodeData {
  shape: WhiteboardShape
  text?: string
  /** `neutral` by default. */
  tone?: Tone
}

export interface WhiteboardStickyData extends WhiteboardNodeData {
  text?: string
  /** `warning` (yellow) by default. */
  tone?: Tone
}

export interface WhiteboardTextData extends WhiteboardNodeData {
  text?: string
}

/** A pen stroke. */
export interface WhiteboardInkData extends WhiteboardNodeData {
  /**
   * The points as `x, y, pressure` triples, flat, in the node's own units:
   * `0, 0` is its top left corner when it is `box` in size.
   */
  points: number[]
  /** The size the points were drawn at; the stroke stretches with the node. */
  box: [number, number]
  /** The stroke's width at full pressure. `4` by default. */
  size?: number
  /** The text color when left out. */
  tone?: Tone
}

export interface WhiteboardImageData extends WhiteboardNodeData {
  src: string
  /** Read by screen readers. */
  alt?: string
}

/** Keys for the tools. */
export const whiteboardKeys: Record<WhiteboardTool, string> = {
  select: 'v',
  hand: 'h',
  rect: 'r',
  ellipse: 'o',
  diamond: 'd',
  sticky: 's',
  text: 't',
  pen: 'p',
  eraser: 'x',
}

/** The key that inserts an image. */
export const imageKey = 'i'

const SIDES = ['top', 'right', 'bottom', 'left'] as const

/**
 * Four anchors, one on each side. Each is an output and an input at the
 * same spot, so a connector can start and end on any of them. Edges in
 * data go from an output (`right`) to an input (`left-in`). The order puts
 * `right` and `left-in` first, so a node added after another joins it left
 * to right.
 */
export const anchorPorts: FlowPortSpec[] = [
  ...(['right', 'bottom', 'left', 'top'] as const).map((side) => ({
    id: side,
    kind: 'output' as const,
    side,
  })),
  ...(['left', 'top', 'right', 'bottom'] as const).map((side) => ({
    id: `${side}-in`,
    kind: 'input' as const,
    side,
    max: Number.POSITIVE_INFINITY,
  })),
]

export const anchorSides = SIDES
