/** One breakpoint of a grid: its name, the narrowest width it applies at, and its columns. */
export interface GridTier {
  name: string
  min: number
  columns: number
}

/** The breakpoint name used when `columns` is one number. */
export const SINGLE_TIER = 'default'

/** A grid's breakpoints, widest first. */
export function gridTiers(
  columns: number | Record<string, number>,
  breakpoints: Record<string, number>,
): GridTier[] {
  if (typeof columns === 'number') return [{ name: SINGLE_TIER, min: 0, columns }]
  const list = Object.entries(columns).map(([name, count]) => ({
    name,
    min: breakpoints[name] ?? 0,
    columns: count,
  }))
  list.sort((a, b) => b.min - a.min)
  return list
}

export const DEFAULT_COLUMNS: Record<string, number> = { lg: 12, md: 6, sm: 1 }
export const DEFAULT_BREAKPOINTS: Record<string, number> = { lg: 1024, md: 640, sm: 0 }
