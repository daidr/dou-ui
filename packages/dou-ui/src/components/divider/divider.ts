export type DividerDirection = 'horizontal' | 'vertical'
export type DividerAlign = 'start' | 'center' | 'end'

export interface DividerProps {
  direction?: DividerDirection
  /** Where the label sits on a horizontal divider. */
  align?: DividerAlign
  /** Draw a dashed line, e.g. for a soft break inside a group. */
  dashed?: boolean
}

export interface DividerSlots {
  /** An optional label, horizontal dividers only. */
  default?: () => unknown
}
