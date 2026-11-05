/**
 * Only the ring: no tooltip, not focusable. A DouTooltip can wrap the ring
 * itself (give it `tabindex="0"`); a popover or dropdown opened by a click
 * needs a button holding the ring, which a span can't stand in for. Name it
 * with `aria-label`.
 */
export interface ChatContextMeterProps {
  /** Tokens used so far. */
  used?: number
  /** Tokens the context holds. */
  total?: number
  /** The share, from 0 to 1, from which the ring turns to the warning tone. */
  warnAt?: number
  /** The share from which it turns to the danger tone. */
  dangerAt?: number
  /** Show the percentage next to the ring. */
  showLabel?: boolean
}

export interface ContextUsage {
  /** Tokens used: a number below 0, or not a finite number, counts as 0. */
  used: number
  /** Tokens the context holds, the same way. */
  total: number
  /** How full, from 0 to 1, as the ring draws it. */
  share: number
  /** The share as a whole percent, as the ring's label shows it: never over 100. */
  percent: number
}

const count = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

/**
 * The numbers the meter shows for `used` and `total`, for a tooltip or
 * details around it that agree with the ring: `percent` stays within 0–100
 * and is 0 without a `total`.
 */
export function contextUsage(used: number, total: number): ContextUsage {
  const u = count(used)
  const all = count(total)
  const share = all > 0 ? Math.min(u / all, 1) : 0
  return { used: u, total: all, share, percent: Math.round(share * 100) }
}

const trim = (n: number) => String(Number(n.toFixed(1)))

/** `45200` → `45.2k`, `1200000` → `1.2M`: how the meter reads its numbers, for tooltips around it. */
export function compactNumber(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e6) return `${trim(value / 1e6)}M`
  if (abs >= 1e3) return `${trim(value / 1e3)}k`
  return String(Math.round(value))
}
