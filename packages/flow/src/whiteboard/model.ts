import type { Tone } from 'dou-ui'

/** What a press on the board does. */
export type WhiteboardTool =
  | 'select'
  | 'hand'
  | 'rect'
  | 'ellipse'
  | 'diamond'
  | 'sticky'
  | 'text'
  | 'pen'
  | 'eraser'
  | 'comment'

/** The tools that put down a node with a box. */
export type WhiteboardShapeTool = Exclude<
  WhiteboardTool,
  'select' | 'hand' | 'pen' | 'eraser' | 'comment'
>

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
  /**
   * The stroke's width drawn with a mouse or finger. `4` by default; a pen
   * makes it 0.4 to 1.6 times as wide as it presses lighter or harder.
   */
  size?: number
  /** The text color when left out. */
  tone?: Tone
}

/** How a connector runs: one straight line, right-angled turns, or a smooth curve. */
export type WhiteboardRoute = 'straight' | 'elbow' | 'curve'
export type WhiteboardDash = 'solid' | 'dashed' | 'dotted' | 'dash-dot'
/** Which ends of a connector have an arrowhead. */
export type WhiteboardArrow = 'none' | 'end' | 'both'

/** A `connector` edge's look. */
export interface WhiteboardConnectorData {
  [key: string]: unknown
  /** `straight` by default. */
  route?: WhiteboardRoute
  /** `solid` by default. */
  dash?: WhiteboardDash
  /** `end` by default. */
  arrow?: WhiteboardArrow
  /** Where an `elbow` connector's middle run sits, from 0 to 1; set by dragging it. */
  bend?: number
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
  comment: 'm',
}

/** The key that inserts an image. */
export const imageKey = 'i'

const SIDES = ['top', 'right', 'bottom', 'left'] as const

export const anchorSides = SIDES
