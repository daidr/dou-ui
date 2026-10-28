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
  /** Called once the toast is gone, however it closed. */
  onClose?: () => void
}

export interface ToastHandle {
  id: number
  close: () => void
}

export interface ToastRecord extends Required<
  Pick<ToastOptions, 'message' | 'tone' | 'duration' | 'closable' | 'placement'>
> {
  id: number
  title?: string
  action?: ToastAction
  onClose?: () => void
}

export interface ToastViewportProps {
  /** The most toasts shown at one placement; older ones close first. */
  max?: number
}
