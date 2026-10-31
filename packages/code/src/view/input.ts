/** A replacement within a string: `from`–`to` of the old string became `insert`. */
export interface TextDiff {
  from: number
  to: number
  insert: string
}

const isHigh = (code: number) => code >= 0xd800 && code < 0xdc00
const isLow = (code: number) => code >= 0xdc00 && code < 0xe000

/**
 * The one replacement that turns `old` into `next`. When text repeats (an
 * `a` typed next to an `a`), the change is placed at `at`, the old caret,
 * which is where typing happens. Surrogate pairs are never split.
 */
export function diffText(old: string, next: string, at = old.length): TextDiff | null {
  if (old === next) return null
  const max = Math.min(old.length, next.length)
  let start = 0
  while (start < max && old.charCodeAt(start) === next.charCodeAt(start)) start++
  start = Math.min(start, at)
  if (start > 0 && isHigh(old.charCodeAt(start - 1))) start--
  let end = 0
  while (
    end < old.length - start &&
    end < next.length - start &&
    old.charCodeAt(old.length - 1 - end) === next.charCodeAt(next.length - 1 - end)
  )
    end++
  if (end > 0 && isLow(old.charCodeAt(old.length - end))) end--
  return { from: start, to: old.length - end, insert: next.slice(start, next.length - end) }
}
