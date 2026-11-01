/** What to look for in the cells, and how. */
export interface SheetFindQuery {
  /** The text to find. */
  search: string
  /** What `replace` puts in place of each match. */
  replace?: string
  /** Tells upper and lower case apart. */
  caseSensitive?: boolean
  /** A cell matches only when its whole text is the search, not when it contains it. */
  wholeCell?: boolean
  /**
   * Where to look: `'values'` (the default) reads the text cells show, a
   * formula's result included; `'formulas'` reads what was typed, so a
   * formula is found by the formula itself.
   */
  lookIn?: 'values' | 'formulas'
  /** Which cells: the sheet shown (the default) or every sheet of the workbook. */
  scope?: 'sheet' | 'workbook'
}

/** A cell that matches, on the sheet with index `sheet`. */
export interface SheetFound {
  sheet: number
  row: number
  col: number
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Tells whether a cell's text matches the query; `null` when there is
 * nothing to look for.
 */
export function cellMatcher(query: SheetFindQuery): ((text: string) => boolean) | null {
  const { search } = query
  if (!search) return null
  if (query.caseSensitive)
    return query.wholeCell ? (text) => text === search : (text) => text.includes(search)
  const lower = search.toLowerCase()
  return query.wholeCell
    ? (text) => text.toLowerCase() === lower
    : (text) => text.toLowerCase().includes(lower)
}

/**
 * The text with every match of the query replaced; the text as it is when
 * nothing in it matches. With `wholeCell` the whole text is replaced.
 */
export function replaceInText(text: string, query: SheetFindQuery): string {
  const test = cellMatcher(query)
  if (!test || !test(text)) return text
  const replace = query.replace ?? ''
  if (query.wholeCell) return replace
  const re = new RegExp(escapeRegExp(query.search), query.caseSensitive ? 'g' : 'gi')
  // a function, so `$&` and the like in the replacement stay as typed
  return text.replace(re, () => replace)
}

/** Whether `a` comes before `b`: by sheet, then row, then column. */
export const foundBefore = (a: SheetFound, b: SheetFound) =>
  a.sheet !== b.sheet ? a.sheet < b.sheet : a.row !== b.row ? a.row < b.row : a.col < b.col

/** The index of the first match at or after `at` (wrapping round to the first); `-1` for none. */
export function foundFrom(list: readonly SheetFound[], at: SheetFound): number {
  if (!list.length) return -1
  let lo = 0
  let hi = list.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (foundBefore(list[mid]!, at)) lo = mid + 1
    else hi = mid
  }
  return lo === list.length ? 0 : lo
}
