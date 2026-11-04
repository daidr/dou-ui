/**
 * The same words as ChatPlan: `pending` hasn't started, `waiting` is paused on
 * someone else, such as the person allowing the call; `withdrawn` means the
 * call was taken back before it ran, as with ChatConfirm; the rest follow the run.
 */
export type ChatToolCallStatus = 'pending' | 'running' | 'waiting' | 'done' | 'error' | 'withdrawn'

export interface ChatToolCallProps {
  /** The tool's name, e.g. `search_web`. */
  name?: string
  /** A readable line shown instead of the name, e.g. "Searching the web". */
  title?: string
  status?: ChatToolCallStatus
  /** What the tool was called with. Objects are shown as formatted JSON. */
  input?: unknown
  /** What it returned, or the error. Objects are shown as formatted JSON. */
  output?: unknown
  /** Expanded or not. Bound with `v-model:open`. */
  open?: boolean
  /**
   * The run is going on now. Off once the turn has ended or been stopped: a
   * `running` call holds still, a solid dot in place of the spinner.
   */
  live?: boolean
}

export interface ChatToolCallEmits {
  'update:open': [open: boolean]
}

export interface ChatToolCallSlots {
  /** Replaces the tool icon. */
  icon?: () => unknown
  /** Replaces the title. */
  title?: () => unknown
  /** Replaces the input section. */
  input?: () => unknown
  /** Replaces the output section. */
  output?: () => unknown
  /** Extra content in the panel, after the output. */
  default?: () => unknown
  /** Under the header, always visible: e.g. allow / deny buttons for a `waiting` call. */
  actions?: () => unknown
}

/** Show a value the way a person reads it: strings as they are, the rest as JSON. */
export function formatToolValue(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}
