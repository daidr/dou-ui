import type { Tone } from 'dou-ui'
import type { FlowPortSpec } from '../core/model'

/** What a press on the board does. */
export type WhiteboardTool = 'select' | 'hand' | 'rect' | 'ellipse' | 'diamond' | 'sticky' | 'text'

/** The tools that add a node. */
export type WhiteboardShapeTool = Exclude<WhiteboardTool, 'select' | 'hand'>

export type WhiteboardShape = 'rect' | 'ellipse' | 'diamond'

export interface WhiteboardShapeData {
  [key: string]: unknown
  shape: WhiteboardShape
  text?: string
  /** `neutral` by default. */
  tone?: Tone
}

export interface WhiteboardStickyData {
  [key: string]: unknown
  text?: string
  /** `warning` (yellow) by default. */
  tone?: Tone
}

export interface WhiteboardTextData {
  [key: string]: unknown
  text?: string
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
}

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
