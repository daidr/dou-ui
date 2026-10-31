import { watch, type Ref } from 'vue'
import type { FlowEditorContext } from '../context'
import { defineFlowExtension, type FlowExtension } from '../core/extension'
import { defineEdgeType } from '../core/edge-types'
import { createId, type FlowData, type FlowNode, type Point, type Rect } from '../core/model'
import { defineNodeType } from '../core/node-types'
import { format, type FlowMessages } from '../locale'
import BoardNode from './board-node.vue'
import BoardDraft from './board-draft.vue'
import WhiteboardToolbar from './whiteboard-toolbar.vue'
import {
  anchorPorts,
  type WhiteboardShapeData,
  type WhiteboardShapeTool,
  type WhiteboardStickyData,
  type WhiteboardTextData,
  type WhiteboardTool,
  whiteboardKeys,
} from './model'
import { boardState } from './state'

/** "Rectangle: text", or just "Rectangle" while it has none. */
const nameOf = (kind: string, text: string | undefined, t: FlowMessages) =>
  text ? format(t.board.named, { kind, text }) : kind

/** A rectangle, ellipse or diamond with centred text; `data.shape` says which. */
export const shapeNode = defineNodeType<WhiteboardShapeData>({
  type: 'shape',
  component: BoardNode,
  ports: anchorPorts,
  frame: false,
  resizable: { minWidth: 24, minHeight: 24 },
  size: { width: 160, height: 100 },
  defaults: () => ({ shape: 'rect' }),
  label: (node, t) => nameOf(t.board[node.data?.shape ?? 'rect'], node.data?.text, t),
})

/** A square note in a soft color. */
export const stickyNode = defineNodeType<WhiteboardStickyData>({
  type: 'sticky',
  component: BoardNode,
  ports: anchorPorts,
  frame: false,
  resizable: { minWidth: 64, minHeight: 64 },
  size: { width: 160, height: 160 },
  defaults: () => ({}),
  label: (node, t) => nameOf(t.board.sticky, node.data?.text, t),
})

/** Text on its own; it grows as it is typed. */
export const textNode = defineNodeType<WhiteboardTextData>({
  type: 'text',
  component: BoardNode,
  ports: anchorPorts,
  frame: false,
  resizable: { minWidth: 24, minHeight: 24 },
  size: { width: 200, height: 40 },
  defaults: () => ({}),
  label: (node, t) => nameOf(t.board.text, node.data?.text, t),
})

const ARROW = { length: 10, spread: 0.45 }
const r2 = (v: number) => Math.round(v * 100) / 100

/** A straight line from anchor to anchor, ending in an open arrow. */
const p = (pt: Point) => `${r2(pt.x)} ${r2(pt.y)}`

export const connectorEdge = defineEdgeType({
  type: 'connector',
  route(source, target) {
    const dx = target.x - source.x
    const dy = target.y - source.y
    const angle = Math.atan2(dy, dx)
    const wing = (turn: number) => ({
      x: target.x - ARROW.length * Math.cos(angle + turn),
      y: target.y - ARROW.length * Math.sin(angle + turn),
    })
    const a = wing(ARROW.spread)
    const b = wing(-ARROW.spread)
    return {
      path: `M${p(source)}L${p(target)}M${p(a)}L${p(target)}L${p(b)}`,
      label: { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 },
    }
  },
})

/** The node type and data each drawing tool adds. */
function kindOf(tool: WhiteboardShapeTool): { type: string; data: FlowData } {
  if (tool === 'sticky' || tool === 'text') return { type: tool, data: {} }
  return { type: 'shape', data: { shape: tool } }
}

function nodeFor(tool: WhiteboardShapeTool, rect: Rect): FlowNode {
  // text grows with what is typed: it keeps no height
  const height = tool === 'text' ? undefined : rect.height
  return { id: createId(), x: rect.x, y: rect.y, width: rect.width, height, ...kindOf(tool) }
}

const SIZES: Record<WhiteboardShapeTool, { width: number; height: number }> = {
  rect: { width: 160, height: 100 },
  ellipse: { width: 140, height: 100 },
  diamond: { width: 140, height: 120 },
  sticky: { width: 160, height: 160 },
  text: { width: 200, height: 40 },
}

/** After a tool put down a node: back to select unless kept, and notes and text open to be written in. */
function added(ctx: FlowEditorContext, tool: WhiteboardShapeTool, id: string) {
  const state = boardState(ctx)
  if (!state.locked.value) state.tool.value = 'select'
  if (tool === 'sticky' || tool === 'text') state.editing.value = id
}

export interface WhiteboardKitOptions {
  /**
   * The current tool, to share with your own toolbar. Made inside the kit
   * when left out.
   */
  tool?: Ref<WhiteboardTool>
  /** The built-in toolbar at the top of the editor. Defaults to `true`. */
  toolbar?: boolean
}

/**
 * The whiteboard: shape, sticky note and text nodes, the `connector` edge,
 * the drawing tools with their keys, and a toolbar. Add it after `flowKit()`.
 */
export function whiteboardKit(options: WhiteboardKitOptions = {}): FlowExtension {
  return defineFlowExtension({
    name: 'whiteboard',
    nodeTypes: [shapeNode, stickyNode, textNode],
    edgeTypes: [connectorEdge],
    edgeType: 'connector',
    layers: { above: [BoardDraft] },
    overlays: options.toolbar === false ? [] : [WhiteboardToolbar],

    setup(ctx) {
      const state = boardState(ctx)
      const stops: (() => void)[] = []
      if (options.tool) {
        const outer = options.tool
        state.tool.value = outer.value
        stops.push(
          watch(outer, (tool) => (state.tool.value = tool)),
          watch(state.tool, (tool) => (outer.value = tool)),
        )
      }
      // the cursor says what a press will do
      stops.push(
        watch(
          state.tool,
          (tool) => {
            const root = ctx.root.value
            if (root) root.dataset.boardTool = tool
          },
          { immediate: true },
        ),
      )
      return () => {
        for (const stop of stops) stop()
        delete ctx.root.value?.dataset.boardTool
      }
    },

    press(ctx, press) {
      const state = boardState(ctx)
      const tool = state.tool.value
      if (tool === 'select') return
      // a press puts down whatever text was being typed
      state.editing.value = null
      if (tool === 'hand') {
        const start = { x: press.event.clientX, y: press.event.clientY }
        const origin = { ...ctx.viewport.value }
        return {
          move(_, event) {
            ctx.viewport.value = {
              ...origin,
              x: origin.x + event.clientX - start.x,
              y: origin.y + event.clientY - start.y,
            }
          },
        }
      }
      const start = press.point
      const rectTo = (point: Point, square: boolean) => {
        let width = Math.abs(point.x - start.x)
        let height = Math.abs(point.y - start.y)
        if (square) width = height = Math.max(width, height)
        return {
          x: point.x < start.x ? start.x - width : start.x,
          y: point.y < start.y ? start.y - height : start.y,
          width,
          height,
        }
      }
      const done = (rect: Rect | null) => {
        state.draft.value = null
        if (!rect) return
        const node = nodeFor(tool, rect)
        ctx.transact((tr) => tr.addNode(node))
        ctx.selection.value = { nodes: [node.id], edges: [] }
        ctx.announce(format(ctx.messages.value.added, { node: ctx.messages.value.board[tool] }))
        added(ctx, tool, node.id)
      }
      return {
        move(point, event) {
          state.draft.value = { ...rectTo(point, event.shiftKey), tool }
        },
        end(point, event) {
          const rect = rectTo(point, event.shiftKey)
          const min = 8 / ctx.viewport.value.zoom
          if (rect.width < min && rect.height < min) {
            // a click: the default size, centred where it was clicked
            const size = SIZES[tool]
            done({ x: start.x - size.width / 2, y: start.y - size.height / 2, ...size })
          } else {
            done({
              ...rect,
              width: Math.max(rect.width, 24),
              height: tool === 'text' ? Math.max(rect.height, 40) : Math.max(rect.height, 24),
            })
          }
        },
        cancel: () => done(null),
      }
    },

    keymap(ctx) {
      const state = boardState(ctx)
      const pick = (tool: WhiteboardTool) => () => {
        state.tool.value = tool
        state.locked.value = false
        const t = ctx.messages.value.board
        ctx.announce(format(t.picked, { tool: t[tool] }))
      }
      const keys: Record<string, () => boolean | void> = {}
      for (const [tool, key] of Object.entries(whiteboardKeys))
        keys[key] = pick(tool as WhiteboardTool)
      return {
        ...keys,
        enter: () => {
          if (ctx.readonly.value) return false
          const tool = state.tool.value
          // with a drawing tool, Enter puts one down: after the selected node, or mid-view
          if (tool !== 'select' && tool !== 'hand') {
            const { type, data } = kindOf(tool)
            // text keeps no height, as when drawn
            const size =
              tool === 'text' ? { width: SIZES.text.width, height: undefined } : SIZES[tool]
            // notes and text take focus in their own field
            const writes = tool === 'sticky' || tool === 'text'
            const id = ctx.insertNode(type, { data, size, focus: !writes })
            if (id) added(ctx, tool, id)
            return
          }
          // otherwise it writes in the selected note or shape
          const { nodes, edges } = ctx.selection.value
          if (nodes.length !== 1 || edges.length || ctx.readonly.value) return false
          const node = ctx.doc.value.nodes.find((n) => n.id === nodes[0])
          if (!node || !['shape', 'sticky', 'text'].includes(node.type ?? '')) return false
          state.editing.value = node.id
        },
        escape: () => {
          if (state.tool.value === 'select') return false
          state.tool.value = 'select'
        },
      }
    },
  })
}
