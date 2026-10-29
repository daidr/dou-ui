export type ChatConfirmStatus = 'pending' | 'approved' | 'denied'
/** What the person chose: once, every time from now on, or not at all. */
export type ChatConfirmDecision = 'approve' | 'always' | 'deny'

export interface ChatConfirmProps {
  /** The question, e.g. "Allow editing 2 files?". */
  title?: string
  /** What will happen, in a sentence. */
  description?: string
  /** `pending` asks; the others show the outcome in one quiet line. */
  status?: ChatConfirmStatus
  /** Offer "Always allow" next to "Allow". */
  allowAlways?: boolean
  /** Paint the allow button in the danger tone, for actions that delete or send. */
  danger?: boolean
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
