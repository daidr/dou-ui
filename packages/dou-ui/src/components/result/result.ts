export type ResultStatus = 'info' | 'success' | 'warning' | 'danger'

export interface ResultProps {
  /** What happened. Sets the icon and its color. */
  status?: ResultStatus
  /** The headline, e.g. "提交成功". */
  title?: string
  /** A line or two on what it means or what to do next. */
  description?: string
}

export interface ResultSlots {
  /** Replaces the icon. */
  icon?: () => unknown
  title?: () => unknown
  description?: () => unknown
  /** Actions under the text, e.g. "back to the list". */
  default?: () => unknown
  /** A quiet box under the actions for details, e.g. an order summary or an error log. */
  extra?: () => unknown
}
