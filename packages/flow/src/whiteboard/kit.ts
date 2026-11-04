import type { ContextMenuItem } from 'dou-ui'
import { RotateCwIcon } from '@dou-ui/icons'
import { watch, type Ref } from 'vue'
import type { FlowEditorContext } from '../context'
import { defineFlowExtension, type FlowExtension } from '../core/extension'
import { createId, type FlowData, type FlowNode, type Point, type Rect } from '../core/model'
import { defineNodeType } from '../core/node-types'
import { format, type FlowMessages } from '../locale'
import BoardNode from './board-node.vue'
import BoardDraft from './board-draft.vue'
import WhiteboardToolbar from './whiteboard-toolbar.vue'
import {
  anchorPorts,
  imageKey,
  type WhiteboardImageData,
  type WhiteboardInkData,
  type WhiteboardNodeData,
  type WhiteboardShapeData,
  type WhiteboardShapeTool,
  type WhiteboardStickyData,
  type WhiteboardTextData,
  type WhiteboardTool,
  whiteboardKeys,
} from './model'
import {
  imageFiles,
  insertImages,
  pickImages,
  type WhiteboardUpload,
  type WhiteboardUploadError,
} from './image'
import { connectorEdge, connectorToolbar } from './connector'
import { drawBoardNode } from './draw'
import { drawInk, erase } from './pen'
import { boardState } from './state'

/** The node types the whiteboard adds; only they turn. */
const BOARD_TYPES = new Set(['shape', 'sticky', 'text', 'ink', 'image'])

/** "Rectangle: text", or just "Rectangle" while it has none. */
const nameOf = (kind: string, text: string | undefined, t: FlowMessages) =>
  text ? format(t.board.named, { kind, text }) : kind

/** How far a board node is turned, from `data.rotation`. */
const turnedBy = (node: FlowNode<WhiteboardNodeData>) => node.data?.rotation ?? 0

/** A rectangle, ellipse or diamond with centred text; `data.shape` says which. */
export const shapeNode = defineNodeType<WhiteboardShapeData>({
  type: 'shape',
  component: BoardNode,
  ports: anchorPorts,
  frame: false,
  resizable: { minWidth: 24, minHeight: 24 },
  rotation: turnedBy,
  draw: drawBoardNode,
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
  rotation: turnedBy,
  draw: drawBoardNode,
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
  rotation: turnedBy,
  draw: drawBoardNode,
  size: { width: 200, height: 40 },
  defaults: () => ({}),
  label: (node, t) => nameOf(t.board.text, node.data?.text, t),
})

/** A pen stroke; it stretches with its box. */
export const inkNode = defineNodeType<WhiteboardInkData>({
  type: 'ink',
  component: BoardNode,
  frame: false,
  resizable: { minWidth: 8, minHeight: 8 },
  rotation: turnedBy,
  draw: drawBoardNode,
  defaults: () => ({ points: [], box: [0, 0] }),
  label: (_, t) => t.board.ink,
})

/** An image; `data.src` is its address. */
export const imageNode = defineNodeType<WhiteboardImageData>({
  type: 'image',
  component: BoardNode,
  ports: anchorPorts,
  frame: false,
  resizable: { minWidth: 24, minHeight: 24 },
  rotation: turnedBy,
  draw: drawBoardNode,
  size: { width: 240, height: 180 },
  defaults: () => ({ src: '' }),
  label: (node, t) => nameOf(t.board.image, node.data?.alt, t),
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
  /**
   * Turns an image file that is dropped, pasted or picked into the `src` it
   * is kept as, e.g. by uploading it and returning its address. Without it,
   * images are kept in the document as data URLs.
   */
  upload?: WhiteboardUpload
  /**
   * Called for each image whose `upload` failed, with the error and the
   * file; the app then tells the user, screen readers included. Without
   * it, a danger toast at the bottom says which images were not added.
   */
  onUploadError?: WhiteboardUploadError
}

/**
 * The whiteboard: shape, sticky note and text nodes, the `connector` edge,
 * the drawing tools with their keys, and a toolbar. Add it after `flowKit()`.
 */
export function whiteboardKit(options: WhiteboardKitOptions = {}): FlowExtension {
  return defineFlowExtension({
    name: 'whiteboard',
    nodeTypes: [shapeNode, stickyNode, textNode, inkNode, imageNode],
    edgeTypes: [connectorEdge],
    edgeToolbarItems: connectorToolbar,
    edgeType: 'connector',
    layers: { above: [BoardDraft] },
    overlays: options.toolbar === false ? [] : [WhiteboardToolbar],

    setup(ctx) {
      const state = boardState(ctx)
      state.upload = options.upload
      state.onUploadError = options.onUploadError
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
        watch(state.panning, (panning) => {
          const root = ctx.root.value
          if (root) root.toggleAttribute('data-board-panning', panning)
        }),
      )
      // images dropped on the board or pasted into it
      const root = ctx.root.value
      const onDragOver = (event: DragEvent) => {
        if (ctx.readonly.value || !event.dataTransfer?.types.includes('Files')) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }
      const onDrop = (event: DragEvent) => {
        const files = imageFiles(event.dataTransfer?.files)
        if (ctx.readonly.value || !files.length) return
        event.preventDefault()
        const at = ctx.toCanvas({ x: event.clientX, y: event.clientY })
        void insertImages(ctx, files, { at })
      }
      const onPaste = (event: ClipboardEvent) => {
        const active = document.activeElement
        if (ctx.readonly.value || !root || !active || !root.contains(active)) return
        // pasting into a field is the field's
        if (active.closest('input, textarea, [contenteditable]')) return
        const files = imageFiles(event.clipboardData?.files)
        if (!files.length) return
        event.preventDefault()
        event.stopImmediatePropagation()
        void insertImages(ctx, files)
      }
      root?.addEventListener('dragover', onDragOver)
      root?.addEventListener('drop', onDrop)
      // before the editor's own paste, which reads nodes from text
      document.addEventListener('paste', onPaste, true)
      return () => {
        for (const stop of stops) stop()
        root?.removeEventListener('dragover', onDragOver)
        root?.removeEventListener('drop', onDrop)
        document.removeEventListener('paste', onPaste, true)
        delete ctx.root.value?.dataset.boardTool
        ctx.root.value?.removeAttribute('data-board-panning')
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
        state.panning.value = true
        const stop = () => (state.panning.value = false)
        return {
          end: stop,
          cancel: stop,
          move(_, event) {
            ctx.setViewport({
              ...origin,
              x: origin.x + event.clientX - start.x,
              y: origin.y + event.clientY - start.y,
            })
          },
        }
      }
      if (tool === 'pen') return drawInk(ctx, press.event)
      if (tool === 'eraser') return erase(ctx, press.point)
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

    contextMenu(ctx, target) {
      if (target.kind !== 'node' || ctx.readonly.value) return []
      const t = ctx.messages.value.board
      const items: ContextMenuItem[] = []
      const node = target.node
      if (BOARD_TYPES.has(node.type ?? '') && ctx.selection.value.nodes.length <= 1) {
        const rotation = (node.data?.rotation as number | undefined) ?? 0
        const rotate = (to: number) => {
          ctx.transact((tr) => tr.updateData(node.id, { rotation: to || undefined }))
          ctx.announce(format(t.turned, { degrees: to }))
        }
        items.push(
          {
            key: 'rotate',
            label: t.rotate,
            icon: RotateCwIcon,
            divided: true,
            disabled: !!node.locked,
            run: () => rotate((rotation + 90) % 360),
          },
          {
            key: 'unrotate',
            label: t.unrotate,
            disabled: !rotation || !!node.locked,
            run: () => rotate(0),
          },
        )
      }
      return items
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
        [imageKey]: () => {
          if (ctx.readonly.value) return false
          pickImages(ctx)
        },
        enter: () => {
          if (ctx.readonly.value) return false
          const tool = state.tool.value
          // with a drawing tool, Enter puts one down: after the selected node, or mid-view
          if (tool !== 'select' && tool !== 'hand' && tool !== 'pen' && tool !== 'eraser') {
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

export { connectorEdge }
