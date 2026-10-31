/**
 * Characters as people see them: the cursor steps over a whole emoji or an
 * accented letter, and words follow the language, so a run of Chinese
 * splits into words instead of being one long one.
 */

// oxlint-disable-next-line no-control-regex
const ASCII = /^[\x00-\x7f]*$/
const SPACE = /\s/
const WORD = /[\p{L}\p{N}\p{M}_$]/u

export const isAscii = (text: string) => ASCII.test(text)

type Segmenter = {
  segment(text: string): Iterable<{ index: number; segment: string; isWordLike?: boolean }>
}
const SegmenterCtor = (
  Intl as unknown as { Segmenter?: new (locale?: string, options?: object) => Segmenter }
).Segmenter
let graphemeSegmenter: Segmenter | undefined
let wordSegmenter: Segmenter | undefined

/** Recently split lines; the ones in view are asked again and again while the cursor moves. */
const cache = new Map<
  string,
  { clusters?: number[]; words?: { from: number; to: number; word: boolean }[] }
>()
function cached(text: string) {
  let entry = cache.get(text)
  if (entry) {
    // Most recently used goes last.
    cache.delete(text)
    cache.set(text, entry)
    return entry
  }
  entry = {}
  cache.set(text, entry)
  if (cache.size > 256) cache.delete(cache.keys().next().value!)
  return entry
}

/** Where each user-perceived character starts, plus the end of the line. */
export function clusterStarts(text: string): number[] {
  const entry = cached(text)
  if (entry.clusters) return entry.clusters
  const out: number[] = []
  if (SegmenterCtor) {
    graphemeSegmenter ??= new SegmenterCtor(undefined, { granularity: 'grapheme' })
    for (const part of graphemeSegmenter.segment(text)) out.push(part.index)
  } else {
    // Without Intl.Segmenter, at least keep surrogate pairs together.
    for (let i = 0; i < text.length; i++) {
      out.push(i)
      const code = text.charCodeAt(i)
      if (code >= 0xd800 && code < 0xdc00) i++
    }
  }
  out.push(text.length)
  return (entry.clusters = out)
}

/** The next character boundary after `col` (or before it with `dir` −1). */
export function moveCluster(text: string, col: number, dir: 1 | -1): number {
  if (dir > 0 ? col >= text.length : col <= 0) return col
  const near = dir > 0 ? text.charCodeAt(col) : text.charCodeAt(col - 1)
  const far = dir > 0 ? text.charCodeAt(col + 1) : text.charCodeAt(col - 2)
  // Plain characters on both sides: one step, no segmenting.
  if (near < 0x80 && (Number.isNaN(far) || far < 0x80 || far === 0x0a)) return col + dir
  const starts = clusterStarts(text)
  if (dir > 0) {
    for (const start of starts) if (start > col) return start
    return text.length
  }
  for (let i = starts.length - 1; i >= 0; i--) if (starts[i]! < col) return starts[i]!
  return 0
}

/** Snaps `col` to the start of the character it falls in. */
export function snapCluster(text: string, col: number): number {
  if (col <= 0 || col >= text.length || isAscii(text)) return col
  let snapped = 0
  for (const start of clusterStarts(text)) {
    if (start > col) break
    snapped = start
  }
  return snapped
}

const enum Kind {
  Space,
  Word,
  Punct,
}

const kindOf = (char: string) =>
  SPACE.test(char) ? Kind.Space : WORD.test(char) ? Kind.Word : Kind.Punct

/** Word segments of a line that isn't plain ASCII, from the language's own word rules. */
function words(text: string) {
  const entry = cached(text)
  if (entry.words) return entry.words
  const out: { from: number; to: number; word: boolean }[] = []
  if (SegmenterCtor) {
    wordSegmenter ??= new SegmenterCtor(undefined, { granularity: 'word' })
    for (const part of wordSegmenter.segment(text))
      out.push({ from: part.index, to: part.index + part.segment.length, word: !!part.isWordLike })
  }
  return (entry.words = out)
}

/** How far a run of one kind reaches from `col` in direction `dir`. */
function run(text: string, col: number, dir: 1 | -1, kind: Kind) {
  while (dir > 0 ? col < text.length : col > 0) {
    const char = dir > 0 ? text[col]! : text[col - 1]!
    if (kindOf(char) !== kind) break
    col += dir
  }
  return col
}

/**
 * Where a word move from `col` lands: past any spaces, then to the far end
 * of the word or the run of punctuation that follows.
 */
export function moveWord(text: string, col: number, dir: 1 | -1): number {
  col = run(text, col, dir, Kind.Space)
  if (dir > 0 ? col >= text.length : col <= 0) return col
  const char = dir > 0 ? text[col]! : text[col - 1]!
  const kind = kindOf(char)
  if (kind === Kind.Word && !isAscii(text)) {
    const segment = words(text).find((part) =>
      dir > 0 ? part.from <= col && part.to > col : part.from < col && part.to >= col,
    )
    if (segment) {
      // Stop at the segment's edge, but not inside a run of ASCII word characters.
      return dir > 0 ? Math.max(segment.to, col + 1) : Math.min(segment.from, col - 1)
    }
  }
  return run(text, col, dir, kind)
}

/** The word, space run or punctuation run around `col`, for a double click. */
export function wordAt(text: string, col: number): { from: number; to: number } {
  if (!text) return { from: 0, to: 0 }
  // Prefer the character after the click, the one before at the end of a line.
  const at = col < text.length ? col : col - 1
  const kind = kindOf(text[at]!)
  if (kind === Kind.Word && !isAscii(text)) {
    const segment = words(text).find((part) => part.from <= at && part.to > at)
    if (segment) return { from: segment.from, to: segment.to }
  }
  return { from: run(text, at, -1, kind), to: run(text, at, 1, kind) }
}

/** Leading spaces and tabs. */
export const indentOf = (text: string) => /^[ \t]*/.exec(text)![0]
