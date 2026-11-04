import type { Size, Tone } from '../../utils/types'

export interface ProgressGroupItem {
  /** How much of `max` this part takes. */
  value: number
  /** Names the part in the legend, the tooltip and for screen readers. */
  label?: string
  /** A tone for the part. Parts without a tone or color take the tones in turn. */
  tone?: Tone
  /** A CSS color instead of `tone`. */
  color?: string
}

/** How the legend lays out its entries. */
export type ProgressGroupLegendDirection = 'horizontal' | 'vertical'

export interface ProgressGroupProps {
  items?: ProgressGroupItem[]
  /** What the whole bar stands for. Defaults to the sum of the values, so the parts fill it. */
  max?: number
  /** The thickness of the bar: 4, 6 or 8px. */
  size?: Size
  /** List the parts under the bar. */
  legend?: boolean
  /**
   * How the legend lays out its entries: side by side, wrapping as they need
   * (`horizontal`), or one per row with the amount at the end (`vertical`).
   */
  legendDirection?: ProgressGroupLegendDirection
  /** Show each part's label and amount in a tooltip on hover. */
  tooltip?: boolean
  /** How an amount is written in the legend and tooltip. Defaults to a percentage of `max`. */
  format?: (value: number, percent: number) => string
  /** Names the bar for screen readers when there is no visible label. */
  label?: string
}

export interface ProgressGroupSlots {
  /** Replaces a legend entry's text. */
  legend?: (props: { item: ProgressGroupItem; percent: number; text: string }) => unknown
}
