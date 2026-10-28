import type { Component, VNodeChild } from 'vue'
import type { Tone } from '../../utils/types'

export type DialogBoxKind = 'alert' | 'confirm' | 'prompt'

export interface DialogBoxOptions {
  /** The heading. */
  title?: string
  /** The message below the heading: text, or a render function for richer content. */
  content?: string | (() => VNodeChild)
  /**
   * What the question is about. `danger` paints the confirm button red and
   * moves the first focus to "cancel"; the other tones only add an icon.
   */
  tone?: Tone
  /** Label of the confirm button. Defaults to the locale's "OK". */
  confirmText?: string
  /** Label of the cancel button. Defaults to the locale's "Cancel". */
  cancelText?: string
  /** A number is in px. Defaults to 420. */
  width?: string | number
  /** Close when the mask behind the panel is pressed. Defaults to `false`. */
  closeOnMask?: boolean
  /** Close on `Escape`, which counts as "cancel". Defaults to `true`. */
  closeOnEscape?: boolean
  /**
   * Called when the confirm button is pressed. While a returned promise is
   * pending the button shows a spinner and the dialog stays open; if it
   * rejects, the dialog stays open so the action can be tried again.
   */
  onConfirm?: (value: string) => unknown
}

export interface DialogAlertOptions extends Omit<DialogBoxOptions, 'cancelText' | 'onConfirm'> {
  onConfirm?: () => unknown
}

export interface DialogConfirmOptions extends Omit<DialogBoxOptions, 'onConfirm'> {
  onConfirm?: () => unknown
}

export interface DialogPromptOptions extends DialogBoxOptions {
  /** The value the field starts with. */
  defaultValue?: string
  placeholder?: string
  /** The native `type` of the field. */
  inputType?: 'text' | 'password' | 'email' | 'url' | 'tel' | 'number'
  /**
   * Check the value before closing. Return `false` or a message to keep the
   * dialog open and show the message under the field.
   */
  validate?: (value: string) => boolean | string | void | Promise<boolean | string | void>
}

/** A dialog opened by one of the `dialog` functions. */
export interface DialogHandle<T> extends Promise<T> {
  /** Close as if "cancel" had been pressed. */
  close: () => void
}

/** Internal: everything the box needs to render. */
export interface DialogBoxState extends DialogPromptOptions {
  kind: DialogBoxKind
  icon?: Component
}
