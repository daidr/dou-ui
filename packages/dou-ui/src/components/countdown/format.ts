const units = [
  ['D', 86_400_000],
  ['H', 3_600_000],
  ['m', 60_000],
  ['s', 1000],
] as const

const tokens = /\[([^\]]*)\]|D+|H+|m+|s+|S+/g

/** Lay out a duration in ms as `format` asks; see `CountdownProps.format`. */
export function formatDuration(ms: number, format: string): string {
  let left = Math.max(0, Math.floor(ms))
  const used = new Set(format.replace(/\[[^\]]*\]/g, '').match(/[DHms]/g))
  const values: Record<string, number> = {}
  for (const [unit, size] of units) {
    if (!used.has(unit)) continue
    values[unit] = Math.floor(left / size)
    left -= values[unit] * size
  }
  return format.replace(tokens, (match, literal: string | undefined) => {
    if (literal !== undefined) return literal
    const unit = match[0]!
    if (unit === 'S') return String(left).padStart(3, '0').slice(0, Math.min(3, match.length))
    return String(values[unit] ?? 0).padStart(match.length, '0')
  })
}

/** Whether `format` shows parts of a second, and so needs more than one tick a second. */
export const showsFraction = (format: string) => /S/.test(format.replace(/\[[^\]]*\]/g, ''))
