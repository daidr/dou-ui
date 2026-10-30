export type RelativeTimeValue = Date | number | string

export interface RelativeTimeProps {
  /** The moment to describe: a `Date`, a timestamp in ms, or a date string. */
  value: RelativeTimeValue
  /** The moment to measure from. Defaults to the current time, kept up to date. */
  now?: RelativeTimeValue
  /**
   * `auto` says "yesterday" and "next week" where the language has such
   * words; `always` says "1 day ago" and "in 1 week".
   */
  numeric?: 'auto' | 'always'
  /** Use the short unit names, e.g. "3 min. ago". */
  short?: boolean
  /** Show the date instead once the moment is more than this many ms away. */
  absoluteAfter?: number
  /**
   * How to show the date with `absoluteAfter`. `YYYY`, `MM`, `DD`, `HH`,
   * `hh`, `mm`, `ss` and `A` are the parts; text in `[]` is kept as it is.
   * Defaults to the locale's date format.
   */
  format?: string
}
