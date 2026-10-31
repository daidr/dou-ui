import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import type { FlowEditorContext } from '../context'
import type { Rect } from '../core/model'
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
    }
    states.set(context, state)
  }
  return state
}
