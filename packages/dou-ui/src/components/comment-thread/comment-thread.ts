import type { CommentAction, CommentAuthor, CommentThread } from './comments'

export type * from './comments'
export {
  applyCommentAction,
  applySharedCommentAction,
  createCommentId,
  readSharedComments,
} from './comments'

export interface CommentThreadProps {
  /**
   * The discussion, bound with `v-model:thread`; kept inside when not bound.
   * `null` shows only the box to write the first comment; sending it
   * creates the thread.
   */
  thread?: CommentThread | null
  /**
   * Who is writing. Only their own comments can be edited and deleted;
   * without it the thread can only be read.
   */
  author?: CommentAuthor
  /** Show the discussion without the reply box, the resolve button or the menus. */
  readonly?: boolean
  /**
   * Offer the resolve button. `false` hides only that button, e.g. for a
   * draft comment that has no resolved state; replies and the menus stay.
   */
  resolvable?: boolean
  /** The hint in the box that starts a thread (`thread` is `null`). Replies always read "Reply". */
  placeholder?: string
  /** Focus the box once mounted, e.g. when the thread opens beside the text it is about. */
  autofocus?: boolean
}

export interface CommentThreadEmits {
  /** The thread after a change; `null` once it was removed. */
  'update:thread': [thread: CommentThread | null]
  /** Every change, to send on to a server or apply elsewhere with `applyCommentAction`. */
  action: [action: CommentAction]
  /** Escape in an empty box, or the cancel button of a thread not yet created. */
  cancel: []
}

export interface CommentThreadSlots {
  /** Above the comments, e.g. the text the discussion is about. */
  header?: () => unknown
}

export interface CommentThreadExpose {
  /** Put the cursor in the reply box. */
  focus: () => void
}
