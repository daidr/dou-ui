export type EditableTrigger = 'click' | 'dblclick'
export type EditableBlurAction = 'submit' | 'cancel'

/** `false` or a message keeps the field open and marks it invalid. */
export type EditableValidateResult = boolean | string | void

export interface EditableProps {
  /** The saved text, bound with `v-model`; only updated once an edit is confirmed. */
  modelValue?: string
  /** Whether the field is open, bound with `v-model:editing`. */
  editing?: boolean
  /** Shown in place of an empty value. */
  placeholder?: string
  /** Edit in a growing text area; `Enter` adds a line and `Mod+Enter` confirms. */
  multiline?: boolean
  /** What opens the field with the pointer. `Enter` and `F2` always do. */
  trigger?: EditableTrigger
  /** What leaving the field does. */
  blurAction?: EditableBlurAction
  /**
   * Checks the new text before it is saved. Return `false` or a message
   * (or a promise of either) to keep the field open.
   */
  validate?: (value: string) => EditableValidateResult | Promise<EditableValidateResult>
  /** Select the whole text when the field opens. */
  selectOnEdit?: boolean
  maxlength?: number
  /** Turns editing off; also follows a disabled form. */
  disabled?: boolean
  /** Accessible name of the field, also read before the text. */
  ariaLabel?: string
}

export interface EditableEmits {
  'update:modelValue': [value: string]
  'update:editing': [editing: boolean]
  /** An edit was confirmed, with the new text, also when it did not change. */
  submit: [value: string]
  /** An edit was dropped. */
  cancel: []
}

export interface EditableSlots {
  /** Replaces how the saved text shows while not editing. */
  default?: (props: { value: string; edit: () => void }) => unknown
}

export interface EditableExpose {
  /** Open the field. */
  edit: () => void
  /** Confirm the current text, going through `validate`. */
  submit: () => Promise<void>
  /** Drop the current text and close. */
  cancel: () => void
}
