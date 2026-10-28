export interface DialogProps {
  /** Whether the dialog is open, bound with `v-model:open`. */
  open?: boolean
  /** The heading; also names the dialog for screen readers. */
  title?: string
  /** The width of the panel; a number is in px. */
  width?: string | number
  /** Center the panel vertically instead of placing it near the top. */
  centered?: boolean
  /** Show a close button in the header. */
  closable?: boolean
  /** Close when the mask behind the panel is pressed. */
  closeOnMask?: boolean
  /** Close on `Escape`. */
  closeOnEscape?: boolean
  /** Stop the page behind from scrolling while open. */
  lockScroll?: boolean
  /** Unmount the content once closed instead of keeping it. */
  destroyOnClose?: boolean
  /**
   * Called before closing from the close button, the mask or `Escape`.
   * Return `false` (or a promise of it) to stay open.
   */
  beforeClose?: () => boolean | void | Promise<boolean | void>
  /** Where to render the dialog; `false` keeps it in place. */
  teleport?: string | HTMLElement | false
}

export interface DialogEmits {
  'update:open': [open: boolean]
  /** Opening started. */
  open: []
  /** The opening transition finished. */
  opened: []
  /** Closing started. */
  close: []
  /** The closing transition finished. */
  closed: []
}

export interface DialogSlots {
  default?: () => unknown
  /** Replaces the text of `title`. */
  title?: () => unknown
  /** Actions at the bottom, usually buttons. */
  footer?: (props: { close: () => void }) => unknown
}

export interface DialogExpose {
  /** Close, going through `beforeClose`. */
  close: () => Promise<void>
}
