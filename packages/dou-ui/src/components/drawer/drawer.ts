export type DrawerPlacement = 'left' | 'right' | 'top' | 'bottom'

export interface DrawerProps {
  /** Whether the drawer is open, bound with `v-model:open`. */
  open?: boolean
  /** The heading; also names the drawer for screen readers. */
  title?: string
  /** The edge the drawer slides in from. */
  placement?: DrawerPlacement
  /**
   * The width of a left or right drawer, or the height of a top or bottom
   * one; a number is in px.
   */
  size?: string | number
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
  /** Where to render the drawer; `false` keeps it in place. */
  teleport?: string | HTMLElement | false
}

export interface DrawerEmits {
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

export interface DrawerSlots {
  default?: () => unknown
  /** Replaces the text of `title`. */
  title?: () => unknown
  /** Actions at the bottom, usually buttons. */
  footer?: (props: { close: () => void }) => unknown
}

export interface DrawerExpose {
  /** Close, going through `beforeClose`. */
  close: () => Promise<void>
}
