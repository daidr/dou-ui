import type { CodeText } from './text'

/** What to look for. */
export interface CodeSearchQuery {
  /** The text, or a regular expression with `regexp`. */
  search: string
  /** Tells upper and lower case apart. */
  caseSensitive?: boolean
  /** Only matches that are whole words. */
  wholeWord?: boolean
  /** `search` is a regular expression (JavaScript syntax). */
  regexp?: boolean
  /** What `replace` puts in; with `regexp`, `$1` and `$<name>` refer to groups. */
  replace?: string
}

export interface CodeMatch {
  from: number
  to: number
}

export interface CodeSearchResult {
  matches: CodeMatch[]
  /** More matches exist beyond `limit`. */
  capped: boolean
  /** Why the regular expression is not valid, when it isn't. */
  error?: string
}

const WORD = /[\p{L}\p{N}_$]/u
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The query as one global regular expression, or the reason it can't be one. */
export function queryRegExp(query: CodeSearchQuery): RegExp | string {
  const flags = 'gmu' + (query.caseSensitive ? '' : 'i')
  try {
    return new RegExp(query.regexp ? query.search : escapeRegExp(query.search), flags)
  } catch (error) {
    return (error as Error).message
  }
}

/**
 * Every match of `query` in `doc`, in order, at most `limit` of them. An
 * empty match (a regular expression like `^`) is skipped, since it would
 * select nothing.
 */
export function searchText(
  doc: CodeText,
  query: CodeSearchQuery,
  limit = 10_000,
): CodeSearchResult {
  if (!query.search) return { matches: [], capped: false }
  const re = queryRegExp(query)
  if (typeof re === 'string') return { matches: [], capped: false, error: re }
  const text = doc.toString()
  const matches: CodeMatch[] = []
  re.lastIndex = 0
  let found: RegExpExecArray | null
  while ((found = re.exec(text))) {
    const from = found.index
    const to = from + found[0].length
    if (to === from) {
      re.lastIndex = from + 1
      continue
    }
    if (query.wholeWord && (WORD.test(text[from - 1] ?? '') || WORD.test(text[to] ?? ''))) continue
    if (matches.length >= limit) return { matches, capped: true }
    matches.push({ from, to })
  }
  return { matches, capped: false }
}

/** The text that replaces one match: `query.replace`, with groups filled in for a regular expression. */
export function replacementFor(doc: CodeText, match: CodeMatch, query: CodeSearchQuery): string {
  const replace = query.replace ?? ''
  if (!query.regexp) return replace
  const re = queryRegExp(query)
  if (typeof re === 'string') return replace
  // Match again at the same place, so `$1` refers to this match's groups (lookbehind sees the text before).
  const text = doc.toString()
  const sticky = new RegExp(re.source, re.flags.replace('g', '') + 'y')
  sticky.lastIndex = match.from
  const found = sticky.exec(text)
  return found ? expand(replace, found) : replace
}

/** Fills `$&`, `$1`…`$99`, `$<name>` and `$$` in a replacement from a match. */
function expand(replace: string, found: RegExpExecArray) {
  return replace.replace(/\$(\$|&|\d{1,2}|<([^>]*)>)/g, (all, what: string, name?: string) => {
    if (what === '$') return '$'
    if (what === '&') return found[0]
    if (name !== undefined) return found.groups?.[name] ?? ''
    const group = Number(what)
    return group < found.length ? (found[group] ?? '') : all
  })
}

/** The index of the first match at or after `pos` (wrapping to the first), or `-1` without matches. */
export function matchAfter(matches: readonly CodeMatch[], pos: number): number {
  if (!matches.length) return -1
  let lo = 0
  let hi = matches.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (matches[mid]!.from < pos) lo = mid + 1
    else hi = mid
  }
  return lo === matches.length ? 0 : lo
}
