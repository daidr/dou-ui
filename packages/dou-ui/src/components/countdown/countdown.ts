export interface CountdownProps {
  /** The moment the countdown ends: a timestamp in ms or a `Date`. */
  value?: number | Date
  /**
   * How to show what is left. `D` days, `H` hours, `m` minutes, `s`
   * seconds, `S` tenths (up to `SSS` for ms); doubled for a leading zero.
   * The largest unit takes the overflow, so `mm:ss` can pass 59 minutes.
   * Text in `[brackets]` is kept as it is.
   */
  format?: string
  /** The label above the time. */
  title?: string
  prefix?: string
  suffix?: string
}

export interface CountdownEmits {
  /** The time is up. */
  finish: []
  /** What is left changed, in ms. */
  change: [remaining: number]
}

export interface CountdownSlots {
  title?: () => unknown
  prefix?: () => unknown
  suffix?: () => unknown
  footer?: () => unknown
}
