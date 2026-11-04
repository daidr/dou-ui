/** `danger` also paints the allow button, for actions that delete or send. */
export type ChatConfirmTone = 'neutral' | 'warning' | 'danger'
/**
 * `waiting` means the same as in ChatPlan: paused until the person answers.
 * `withdrawn` means the assistant no longer needs an answer, e.g. the run
 * was stopped or the plan changed before the person replied.
 */
export type ChatConfirmStatus = 'waiting' | 'approved' | 'denied' | 'withdrawn'
/** What the person chose: once, every time from now on, or not at all. */
export type ChatConfirmDecision = 'approve' | 'always' | 'deny'

export interface ChatConfirmProps {
  /** The question, e.g. "Allow editing 2 files?". */
  title?: string
  /** What will happen, in a sentence. */
  description?: string
  /** `waiting` asks; the others show how it ended in one quiet line. */
  status?: ChatConfirmStatus
  /** Offer "Always allow" next to "Allow". */
  allowAlways?: boolean
  /** The icon's color; `danger` also paints the allow button. */
  tone?: ChatConfirmTone
  /** Text of the allow button. Defaults to the locale's "Allow". */
  approveText?: string
  /** Text of the deny button. Defaults to the locale's "Deny". */
  denyText?: string
}

export interface ChatConfirmEmits {
  /** A button was pressed. Updating `status` is up to you. */
  decide: [decision: ChatConfirmDecision]
}

export interface ChatConfirmSlots {
  /** What the action will do in detail, e.g. a diff or the command to run. */
  default?: () => unknown
  /** Replaces the icon. */
  icon?: () => unknown
  /** Replaces the title. */
  title?: () => unknown
}
