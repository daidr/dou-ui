export type CopyButtonSize = 'sm' | 'md'
export type CopyButtonVariant = 'ghost' | 'outline'

export interface CopyButtonProps {
  /** What to copy, or a function that returns it when the button is pressed. */
  text?: string | (() => string | Promise<string>)
  /** Names the button. Defaults to the locale's "Copy". */
  label?: string
  /** Said and shown once copied. Defaults to the locale's "Copied". */
  copiedLabel?: string
  /** Show the label next to the icon, not only to screen readers. */
  showLabel?: boolean
  size?: CopyButtonSize
  variant?: CopyButtonVariant
  /** How long the "copied" state lasts, in ms. */
  duration?: number
  disabled?: boolean
}

export interface CopyButtonEmits {
  copy: [text: string]
  error: [error: unknown]
}
