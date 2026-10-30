export type StatisticTrend = 'up' | 'down'

export interface StatisticProps {
  /** The label above the number. */
  title?: string
  /** The number. A string is shown as it is, e.g. `'—'` while there is no data. */
  value?: number | string | null
  /** Digits after the decimal point. Leaves the number as it is when unset. */
  precision?: number
  /** Put between groups of three digits. `''` turns grouping off. Defaults to the locale's. */
  groupSeparator?: string
  /** Defaults to the locale's. */
  decimalSeparator?: string
  /** Text before the number, e.g. a currency sign. */
  prefix?: string
  /** Text after the number, e.g. a unit. */
  suffix?: string
  /** An arrow before the number that says which way it moved. */
  trend?: StatisticTrend
  /**
   * Whether up is good: `true` colors up as success and down as danger,
   * `false` the other way round (for costs, errors or latency).
   */
  upIsGood?: boolean
  /** Turn the number into something else entirely, e.g. a duration. */
  format?: (value: number) => string
  /**
   * When the number changes, count from the old value to the new one,
   * rounded to `precision` (or the new value's decimals) along the way.
   * Jumps straight to the new value when motion is reduced.
   */
  animated?: boolean
  /** Show a placeholder bar in place of the number. */
  loading?: boolean
}

export interface StatisticSlots {
  title?: () => unknown
  prefix?: () => unknown
  suffix?: () => unknown
  /** Under the number, e.g. "比上周 +12%". */
  footer?: () => unknown
}
