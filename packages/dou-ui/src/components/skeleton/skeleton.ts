export type SkeletonVariant = 'text' | 'rect' | 'circle'

export interface SkeletonProps {
  /** `text` draws lines, `rect` a block, `circle` an avatar. */
  variant?: SkeletonVariant
  /** Lines drawn by the `text` variant; the last one is shorter. */
  lines?: number
  /** A number is in px. */
  width?: string | number
  /** A number is in px. For `circle`, defaults to the width. */
  height?: string | number
  /** Show the placeholder; once `false`, the default slot renders instead. */
  loading?: boolean
  /** Sweep a soft highlight across the placeholder. */
  animated?: boolean
}

export interface SkeletonSlots {
  /** The real content, shown once `loading` is `false`. */
  default?: () => unknown
}
