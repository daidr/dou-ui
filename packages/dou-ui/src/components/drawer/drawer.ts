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
  /**
   * Let the inner edge be dragged to resize the drawer, also with the
   * arrow keys. The new size in px goes to `update:size`.
   */
  resizable?: boolean
  /** The smallest size when resizing, in px. */
  minSize?: number
  /** The largest size when resizing, in px. Defaults to the viewport less 48px. */
  maxSize?: number
  /**
   * Let the drawer be dragged towards its edge to close, by touch anywhere
   * on it or with a mouse on the header. Top and bottom drawers show a
   * handle.
   */
  swipeable?: boolean
  /**
   * Sizes the drawer rests at, dragged between with `swipeable`. Up to 1 is
   * a share of the viewport, above 1 is px. Replaces `size`.
   */
  snapPoints?: number[]
  /** The snap point the drawer rests at, bound with `v-model:snap`. */
  snap?: number
}

export interface DrawerEmits {
  'update:open': [open: boolean]
  /** The drawer was resized, in px; bound with `v-model:size`. */
  'update:size': [size: number]
  /** The drawer moved to another snap point; bound with `v-model:snap`. */
  'update:snap': [snap: number]
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
