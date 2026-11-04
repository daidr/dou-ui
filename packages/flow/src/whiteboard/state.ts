import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import type { FlowEditorContext } from '../context'
import type { Point, Rect } from '../core/model'
import type { WhiteboardUpload, WhiteboardUploadErrorHandler } from './image'
import type { InkPoint } from './ink'
import type { WhiteboardShapeTool, WhiteboardTool } from './model'

/** What the board's pieces share within one editor. */
export interface WhiteboardState {
  tool: Ref<WhiteboardTool>
  /** Keeps the tool after drawing, instead of going back to select. */
  locked: Ref<boolean>
  /** The hand is dragging the view. */
  panning: Ref<boolean>
  /** The node whose text is being typed. */
  editing: ShallowRef<string | null>
  /** The box being drawn, with the tool drawing it. */
  draft: ShallowRef<(Rect & { tool: WhiteboardShapeTool }) | null>
  /** The stroke being drawn with the pen, in canvas coordinates. */
  ink: ShallowRef<InkPoint[] | null>
  /** Strokes the eraser has touched, removed once it lets go. */
  erasing: ShallowRef<ReadonlySet<string>>
  /** Where the eraser is, while it is pressed. */
  eraser: ShallowRef<Point | null>
  /**
   * Where the turn and corner handles of the selected node are drawn: a
   * layer above every node, so a neighbour never covers them.
   */
  handles: ShallowRef<HTMLElement | null>
  /** Images being uploaded. */
  uploading: Ref<number>
  /** The kit's `upload` option. */
  upload?: WhiteboardUpload
  /** The kit's `onUploadError` option. */
  onUploadError?: WhiteboardUploadErrorHandler
}

const states = new WeakMap<FlowEditorContext, WhiteboardState>()

/** The board's state in an editor, made on first use. */
export function boardState(context: FlowEditorContext): WhiteboardState {
  let state = states.get(context)
  if (!state) {
    state = {
      tool: ref('select'),
      locked: ref(false),
      panning: ref(false),
      editing: shallowRef(null),
      draft: shallowRef(null),
      ink: shallowRef(null),
      erasing: shallowRef(new Set()),
      eraser: shallowRef(null),
      handles: shallowRef(null),
      uploading: ref(0),
    }
    states.set(context, state)
  }
  return state
}
