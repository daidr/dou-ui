export interface ChatContextMeterProps {
  /** Tokens used so far. */
  used?: number
  /** Tokens the context holds. */
  total?: number
  /** How numbers read in the tooltip. Defaults to a compact form, e.g. `45.2k`. */
  format?: (value: number) => string
  /** The share, from 0 to 1, from which the ring turns to the warning tone. */
  warnAt?: number
  /** The share from which it turns to the danger tone. */
  dangerAt?: number
  /** Show the percentage next to the ring. */
  showLabel?: boolean
}

const trim = (n: number) => String(Number(n.toFixed(1)))

/** `45200` → `45.2k`, `1200000` → `1.2M`. */
export function compactNumber(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e6) return `${trim(value / 1e6)}M`
  if (abs >= 1e3) return `${trim(value / 1e3)}k`
  return String(Math.round(value))
}
