import type { Tone } from '../../utils/types'

export type ToastTone = Tone
export type ToastPlacement =
  'top' | 'top-left' | 'top-right' | 'bottom' | 'bottom-left' | 'bottom-right'

export interface ToastAction {
  label: string
  /** Runs when the action is pressed; the toast closes afterwards. */
  onClick: () => void
}

export interface ToastOptions {
  message: string
  /** A bold line above the message. */
  title?: string
  tone?: ToastTone
  /** How long the toast stays, in ms. `0` keeps it until closed. Hovering pauses it. */
  duration?: number
  /** Show a close button. */
  closable?: boolean
  placement?: ToastPlacement
  /** One button, e.g. "Undo". */
  action?: ToastAction
  /**
   * Show a spinner in place of the tone icon, for work still under way.
   * A loading toast stays until it is updated or closed.
   */
  loading?: boolean
  /** Called once the toast is gone, however it closed. */
  onClose?: () => void
}

export interface ToastHandle {
  id: number
  close: () => void
  /**
   * Change the toast in place, e.g. from "保存中…" to "已保存". The
   * countdown starts over with the new `duration`; a toast that stops
   * loading gets the default one.
   */
  update: (input: string | Partial<ToastOptions>) => void
}

/** What `toast.promise` shows when the promise settles: text, options, or a function of the result. */
export type ToastPromiseState<T> = string | ToastOptions | ((value: T) => string | ToastOptions)

export interface ToastPromiseMessages<T> {
  loading: string | ToastOptions
  success: ToastPromiseState<T>
  error: ToastPromiseState<unknown>
}

export interface ToastRecord extends Required<
  Pick<ToastOptions, 'message' | 'tone' | 'duration' | 'closable' | 'placement' | 'loading'>
> {
  id: number
  title?: string
  action?: ToastAction
  onClose?: () => void
  /** Bumped by every update, so the item restarts its countdown. */
  version: number
}

export interface ToastViewportProps {
  /** The most toasts shown at one placement; older ones close first. */
  max?: number
  /**
   * Stack the toasts at one placement, newest in front, and spread them
   * out while the pointer or focus is on them. `false` always shows them
   * spread out.
   */
  stacked?: boolean
}
