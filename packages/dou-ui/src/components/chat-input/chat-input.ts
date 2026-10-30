import type { Component } from 'vue'
import type { Size } from '../../utils/types'

/** An entry of the `/` command or `@` mention menu. */
export interface ChatInputOption {
  /** What is matched and handed back. For a mention it is also what gets inserted after `@`. */
  value: string
  /** Shown in the menu. Defaults to `value`. */
  label?: string
  /** A quieter line after the label. */
  description?: string
  /** An icon component before the label. */
  icon?: Component
  disabled?: boolean
}

/** `enter` sends on Enter (Shift+Enter breaks the line); `mod-enter` sends on Ctrl / ⌘ + Enter. */
export type ChatInputSubmitOn = 'enter' | 'mod-enter'

export interface ChatInputProps {
  /** The text, bound with `v-model`. */
  modelValue?: string
  /** Defaults to the locale's prompt. */
  placeholder?: string
  /** Which key sends. Keys pressed while an input method is composing never send. */
  submitOn?: ChatInputSubmitOn
  /**
   * A reply is being generated: the send button turns into a stop button.
   * Typing goes on meanwhile; once there is text, the button sends again
   * so the app can queue the message.
   */
  loading?: boolean
  /** Text size and padding; the corners and buttons follow. */
  size?: Size
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
  /**
   * Commands offered when the text starts with `/`. Picking one removes
   * the typed `/…` and emits `command`.
   */
  commands?: ChatInputOption[]
  /**
   * Things to reference offered after `@`, e.g. files or people. Picking
   * one replaces the typed `@…` with `@value` and emits `mention`.
   */
  mentions?: ChatInputOption[]
  /** Where to render the `/` and `@` menu; `false` keeps it in place. */
  teleport?: string | HTMLElement | false
}

export interface ChatInputEmits {
  'update:modelValue': [value: string]
  /** The send key or button was pressed, with the text. Clearing it is up to you. */
  submit: [value: string]
  /** The stop button was pressed while `loading`. */
  stop: []
  /** A command was picked from the `/` menu. */
  command: [option: ChatInputOption]
  /** Something was picked from the `@` menu. */
  mention: [option: ChatInputOption]
  /** Files were pasted or dropped onto the input. */
  attach: [files: File[]]
}

export interface ChatInputSlots {
  /** Above the text, e.g. `DouChatAttachments` or a quoted message. */
  header?: () => unknown
  /** The left of the bottom bar: buttons to attach files, pick a model and the like. */
  actions?: () => unknown
  /** Replaces the inside of each menu entry. */
  option?: (props: { option: ChatInputOption; trigger: '/' | '@' }) => unknown
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

/** The `/` or `@` token the caret is in, if any. */
export interface ChatInputToken {
  trigger: '/' | '@'
  /** Typed after the trigger. */
  query: string
  /** Where the trigger character is. */
  start: number
  /** Where the token ends (the caret). */
  end: number
}

/**
 * Find the token being typed at `caret`. A `/` counts only at the very
 * start of the text; an `@` at the start or after white space. The query
 * holds no white space.
 */
export function findToken(text: string, caret: number): ChatInputToken | null {
  let start = caret
  while (start > 0 && !/\s/.test(text[start - 1]!)) start--
  const word = text.slice(start, caret)
  const trigger = word[0]
  if (trigger === '/' && text.slice(0, start).trim() === '')
    return { trigger, query: word.slice(1), start, end: caret }
  if (trigger === '@') return { trigger, query: word.slice(1), start, end: caret }
  return null
}
