import type { Size } from '../../utils/types'

export type SpaceDirection = 'horizontal' | 'vertical'
export type SpaceAlign = 'start' | 'center' | 'end' | 'baseline' | 'stretch'
export type SpaceJustify = 'start' | 'center' | 'end' | 'between'

export interface SpaceProps {
  direction?: SpaceDirection
  /** Gap between items: a step of the spacing scale, or any CSS length (numbers are pixels). */
  size?: Size | number | string
  /** Cross-axis alignment. Defaults to `center` horizontally and `stretch` vertically. */
  align?: SpaceAlign
  /** Main-axis distribution. */
  justify?: SpaceJustify
  /** Let items flow onto new lines. */
  wrap?: boolean
  /** Take the full width of the container instead of shrinking to the content. */
  block?: boolean
}

export interface SpaceSlots {
  default?: () => unknown
}
