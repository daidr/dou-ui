import type { SpinnerSize } from '../spinner/spinner'

export interface LoadingProps {
  /** Cover the content with the loading mask. */
  loading?: boolean
  /** A line under the spinner, e.g. "正在保存". Also read by screen readers. */
  text?: string
  /** Cover the whole window instead of the content, above every other layer. */
  fullscreen?: boolean
  /**
   * Wait this many ms before showing the mask, so work that finishes
   * quickly does not flash it. Hiding is always immediate.
   */
  delay?: number
  /** The spinner size. */
  size?: SpinnerSize
}

export interface LoadingSlots {
  /** The content the mask covers. */
  default?: () => unknown
}

/** The value of `v-loading`: a flag, or the flag with the same options as `DouLoading`. */
export type LoadingDirectiveValue =
  boolean | (Pick<LoadingProps, 'text' | 'size' | 'delay'> & { loading?: boolean })
