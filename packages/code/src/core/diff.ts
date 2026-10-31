import { splitLines } from './text'

/**
 * Where two texts differ inside a changed block: characters `from` to `to`
 * of the original text became characters `from` to `to` of the modified
 * one (offsets in each whole text). An empty side is a pure insertion or
 * deletion.
 */
export interface CodeDiffPart {
  original: { from: number; to: number }
  modified: { from: number; to: number }
}

/**
 * A block of lines that changed, numbered as in a unified diff: from line
 * `originalStart` (from 1) `originalCount` lines of the original became
 * `modifiedCount` lines from `modifiedStart`. A count of 0 is a pure
 * insertion or deletion, placed after the line before its start.
 */
export interface CodeDiffHunk {
  originalStart: number
  originalCount: number
  modifiedStart: number
  modifiedCount: number
  /**
   * The words that differ, when lines changed on both sides and enough of
   * them stayed the same to be worth marking; empty otherwise.
   */
  parts: CodeDiffPart[]
}

export interface CodeDiffOptions {
  /** Treats lines that differ only in spaces as the same. */
  ignoreWhitespace?: boolean
  /** Works out the words that differ inside changed lines. On by default. */
  words?: boolean
  /**
   * How hard to look for the smallest diff, in edit steps per block; past
   * it the rest of a block counts as replaced. Defaults to 1000.
   */
  maxCost?: number
}

/** A changed range by index: `a[aFrom..aTo)` became `b[bFrom..bTo)`. */
type Change = [aFrom: number, aTo: number, bFrom: number, bTo: number]

/**
 * The middle of the shortest edit path from `a[aLo..aHi)` to `b[bLo..bHi)`,
 * found from both ends at once (Myers, linear space), or `null` when the
 * two share nothing or it costs more than `maxCost` steps.
 */
function bisect(
  a: ArrayLike<unknown>,
  aLo: number,
  aHi: number,
  b: ArrayLike<unknown>,
  bLo: number,
  bHi: number,
  maxCost: number,
): [number, number] | null {
  const n = aHi - aLo
  const m = bHi - bLo
  const maxD = Math.min(Math.ceil((n + m) / 2), maxCost)
  const offset = maxD + 1
  const size = 2 * offset + 1
  const v1 = new Int32Array(size).fill(-1)
  const v2 = new Int32Array(size).fill(-1)
  v1[offset + 1] = 0
  v2[offset + 1] = 0
  const delta = n - m
  // With an odd difference the paths meet on a forward step, else on a reverse one.
  const front = (delta & 1) !== 0
  let k1start = 0
  let k1end = 0
  let k2start = 0
  let k2end = 0
  for (let d = 0; d < maxD; d++) {
    for (let k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
      const i = offset + k1
      let x1 = k1 === -d || (k1 !== d && v1[i - 1]! < v1[i + 1]!) ? v1[i + 1]! : v1[i - 1]! + 1
      let y1 = x1 - k1
      while (x1 < n && y1 < m && a[aLo + x1] === b[bLo + y1]) {
        x1++
        y1++
      }
      v1[i] = x1
      if (x1 > n) k1end += 2
      else if (y1 > m) k1start += 2
      else if (front) {
        const j = offset + delta - k1
        if (j >= 0 && j < size && v2[j] !== -1 && x1 >= n - v2[j]!) return [x1, y1]
      }
    }
    for (let k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
      const i = offset + k2
      let x2 = k2 === -d || (k2 !== d && v2[i - 1]! < v2[i + 1]!) ? v2[i + 1]! : v2[i - 1]! + 1
      let y2 = x2 - k2
      while (x2 < n && y2 < m && a[aHi - x2 - 1] === b[bHi - y2 - 1]) {
        x2++
        y2++
      }
      v2[i] = x2
      if (x2 > n) k2end += 2
      else if (y2 > m) k2start += 2
      else if (!front) {
        const j = offset + delta - k2
        if (j >= 0 && j < size && v1[j] !== -1) {
          const x1 = v1[j]!
          const y1 = x1 - (j - offset)
          if (x1 >= n - x2) return [x1, y1]
        }
      }
    }
  }
  return null
}

/** The changes from `a[aLo..aHi)` to `b[bLo..bHi)`, in order, pushed to `out`. */
function diffRange(
  a: ArrayLike<unknown>,
  aLo: number,
  aHi: number,
  b: ArrayLike<unknown>,
  bLo: number,
  bHi: number,
  maxCost: number,
  out: Change[],
) {
  while (aLo < aHi && bLo < bHi && a[aLo] === b[bLo]) {
    aLo++
    bLo++
  }
  while (aLo < aHi && bLo < bHi && a[aHi - 1] === b[bHi - 1]) {
    aHi--
    bHi--
  }
  if (aLo === aHi && bLo === bHi) return
  if (aLo === aHi || bLo === bHi) {
    out.push([aLo, aHi, bLo, bHi])
    return
  }
  const split = bisect(a, aLo, aHi, b, bLo, bHi, maxCost)
  if (!split) {
    out.push([aLo, aHi, bLo, bHi])
    return
  }
  diffRange(a, aLo, aLo + split[0], b, bLo, bLo + split[1], maxCost, out)
  diffRange(a, aLo + split[0], aHi, b, bLo + split[1], bHi, maxCost, out)
}

/** The changes between two lists, items compared with `===`, with touching ones joined. */
function diffLists(a: ArrayLike<unknown>, b: ArrayLike<unknown>, maxCost: number): Change[] {
  const raw: Change[] = []
  diffRange(a, 0, a.length, b, 0, b.length, maxCost, raw)
  const out: Change[] = []
  for (const change of raw) {
    const last = out[out.length - 1]
    if (last && last[1] === change[0] && last[3] === change[2]) {
      last[1] = change[1]
      last[3] = change[3]
    } else out.push(change)
  }
  return out
}

/** Words, runs of spaces, and single other characters (each CJK character on its own). */
const TOKEN = /[\p{L}\p{N}_$]+|\s+|[^]/gu
const CJK = /[⺀-鿿豈-﫿＀-￯]/u

function tokenize(text: string) {
  const tokens: string[] = []
  const starts: number[] = []
  for (const match of text.matchAll(TOKEN)) {
    const word = match[0]
    // CJK has no spaces between words: each character counts as one.
    if (word.length > 1 && CJK.test(word))
      for (let i = 0; i < word.length; i++) {
        tokens.push(word[i]!)
        starts.push(match.index! + i)
      }
    else {
      tokens.push(word)
      starts.push(match.index!)
    }
  }
  starts.push(text.length)
  return { tokens, starts }
}

/** Above this many characters on both sides together, a block's words aren't compared. */
const WORDS_LIMIT = 20_000

/** The words that differ between two blocks of text, at offsets `aBase` and `bBase`. */
function diffWords(
  a: string,
  aBase: number,
  b: string,
  bBase: number,
  maxCost: number,
): CodeDiffPart[] {
  if (a.length + b.length > WORDS_LIMIT) return []
  const ta = tokenize(a)
  const tb = tokenize(b)
  const changes = diffLists(ta.tokens, tb.tokens, maxCost)
  // Join changes with only a space or one character between them: easier to read.
  const joined: Change[] = []
  for (const change of changes) {
    const last = joined[joined.length - 1]
    if (last) {
      const gap = ta.starts[change[0]]! - ta.starts[last[1]]!
      const gapText = a.slice(ta.starts[last[1]]!, ta.starts[change[0]]!)
      if (gap <= 1 || /^[ \t]+$/.test(gapText)) {
        last[1] = change[1]
        last[3] = change[3]
        continue
      }
    }
    joined.push([...change])
  }
  // Marking nearly everything says nothing the line colors don't.
  let same = a.length
  for (const [aFrom, aTo] of joined) same -= ta.starts[aTo]! - ta.starts[aFrom]!
  if (same < Math.min(a.length, b.length) * 0.3) return []
  return joined.map(([aFrom, aTo, bFrom, bTo]) => ({
    original: { from: aBase + ta.starts[aFrom]!, to: aBase + ta.starts[aTo]! },
    modified: { from: bBase + tb.starts[bFrom]!, to: bBase + tb.starts[bTo]! },
  }))
}

/** The lines of a text; a plain split when there is no `\r`, which is much faster. */
const linesOf = (text: string) => (text.includes('\r') ? splitLines(text) : text.split('\n'))
const squeeze = (text: string) => text.replace(/\s+/g, ' ').trim()

/** Where each line starts in the text, plus where the text would go on after the last one. */
export function lineStarts(lines: readonly string[]): number[] {
  const starts: number[] = []
  let pos = 0
  for (const line of lines) {
    starts.push(pos)
    pos += line.length + 1
  }
  starts.push(pos)
  return starts
}

/**
 * The blocks of lines that differ between `original` and `modified`, in
 * order, each with the words that differ inside it. Lines are compared
 * whole (Myers' algorithm, in linear space).
 */
export function diffText(
  original: string,
  modified: string,
  options: CodeDiffOptions = {},
): CodeDiffHunk[] {
  const maxCost = options.maxCost ?? 1000
  const aLines = linesOf(original)
  const bLines = linesOf(modified)
  const changes = options.ignoreWhitespace
    ? diffLists(aLines.map(squeeze), bLines.map(squeeze), maxCost)
    : diffLists(aLines, bLines, maxCost)
  const aStarts = lineStarts(aLines)
  const bStarts = lineStarts(bLines)
  const words = options.words !== false
  return changes.map(([aFrom, aTo, bFrom, bTo]) => {
    const hunk: CodeDiffHunk = {
      originalStart: aFrom + 1,
      originalCount: aTo - aFrom,
      modifiedStart: bFrom + 1,
      modifiedCount: bTo - bFrom,
      parts: [],
    }
    if (words && aTo > aFrom && bTo > bFrom) {
      const aText = aLines.slice(aFrom, aTo).join('\n')
      const bText = bLines.slice(bFrom, bTo).join('\n')
      hunk.parts = diffWords(aText, aStarts[aFrom]!, bText, bStarts[bFrom]!, maxCost)
    }
    return hunk
  })
}
