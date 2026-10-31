/** How well a typed word matches a label, and which characters of the label it hit. */
export interface CodeCompletionMatch {
  score: number
  /** `[from, to]` pieces of the label that were typed, for drawing them stronger. */
  ranges: Array<[number, number]>
}

const isUpper = (code: number) => code >= 65 && code <= 90
const isWordChar = (code: number) =>
  (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)

/** Whether label position `i` starts a word: the first character, after `_`, `-`, `.` or a space, or a capital after a small letter. */
function startsWord(label: string, i: number) {
  if (i === 0) return true
  const code = label.charCodeAt(i)
  const prev = label.charCodeAt(i - 1)
  if (!isWordChar(prev)) return true
  return isUpper(code) && !isUpper(prev)
}

/**
 * Matches `query` against `label`: its characters in order, ignoring
 * case. A prefix scores best, then characters at word starts (`gEB` for
 * `getElementById`), then characters further apart. `null` when some
 * character can't be found.
 */
export function matchCompletion(label: string, query: string): CodeCompletionMatch | null {
  if (!query) return { score: 0, ranges: [] }
  const lower = label.toLowerCase()
  const q = query.toLowerCase()
  if (lower.startsWith(q)) {
    // The exact case typed counts a little more.
    const exact = label.startsWith(query) ? 1 : 0
    return { score: 1000 + exact - label.length / 100, ranges: [[0, query.length]] }
  }
  // Characters in order, preferring word starts: greedy with a look for a word start first.
  const ranges: Array<[number, number]> = []
  let score = 0
  let at = 0
  for (let i = 0; i < q.length; i++) {
    const ch = q[i]!
    let found = -1
    for (let j = at; j < lower.length; j++)
      if (lower[j] === ch && startsWord(label, j)) {
        found = j
        break
      }
    // A word start is worth skipping ahead for; else the next one in order.
    const next = lower.indexOf(ch, at)
    if (found < 0 || (next >= 0 && next === at)) found = next
    if (found < 0) return null
    score += found === at ? 3 : startsWord(label, found) ? 2 : 0
    const last = ranges[ranges.length - 1]
    if (last && last[1] === found) last[1] = found + 1
    else ranges.push([found, found + 1])
    at = found + 1
  }
  return { score: score * 10 - ranges.length * 5 - label.length / 100, ranges }
}
