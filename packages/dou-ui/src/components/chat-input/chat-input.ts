/** `enter` sends on Enter (Shift+Enter breaks the line); `mod-enter` sends on Ctrl / ⌘ + Enter. */
export type ChatInputSubmitOn = 'enter' | 'mod-enter'

export interface ChatInputProps {
  /** The text, bound with `v-model`. */
  modelValue?: string
  /** Defaults to the locale's prompt. */
  placeholder?: string
  /** Which key sends. Keys pressed while an input method is composing never send. */
  submitOn?: ChatInputSubmitOn
  /** A reply is being generated: the send button turns into a stop button. */
  loading?: boolean
  disabled?: boolean
  /** Rows shown when empty. */
  minRows?: number
  /** Rows to grow to before the text scrolls. */
  maxRows?: number
  /**
   * Whether sending is allowed. By default only when the text is not
   * blank; set it when, say, attachments alone may be sent.
   */
  canSubmit?: boolean
}

export interface ChatInputEmits {
  'update:modelValue': [value: string]
  /** The send key or button was pressed, with the text. Clearing it is up to you. */
  submit: [value: string]
  /** The stop button was pressed while `loading`. */
  stop: []
  /** Files were pasted or dropped onto the input. */
  attach: [files: File[]]
}

export interface ChatInputSlots {
  /** Above the text, e.g. `DouChatAttachments` or a quoted message. */
  header?: () => unknown
  /** The left of the bottom bar: buttons to attach files, pick a model and the like. */
  actions?: () => unknown
  /** Replaces the send / stop button. */
  submit?: (props: {
    submit: () => void
    stop: () => void
    loading: boolean
    disabled: boolean
  }) => unknown
}

export interface ChatInputExpose {
  /** The native `<textarea>`. */
  textarea: HTMLTextAreaElement | null
  focus: () => void
  blur: () => void
  /** Send as if the send key were pressed. */
  submit: () => void
}
