import type { ChangeSet } from '../core/changes'
import type { CodeText } from '../core/text'
import { type CodeLanguage, type CodeLineTokens, tokenizeLine } from './language'

/** Lines between the start states kept: a line read again costs at most this many. */
const INTERVAL = 32
/** Lines whose tokens are kept; the rest are read again from a kept state when drawn. */
const CACHE = 4000

export interface CodeHighlighterOptions {
  tabSize?: number
  /** Lines between kept start states. */
  interval?: number
  /** Lines whose tokens are kept. */
  cache?: number
}

/**
 * Keeps the tokens of a text up to date as it changes.
 *
 * Reading goes down from the top. It keeps the state at the start of
 * every 32nd line read, and the tokens of the lines drawn lately; a line
 * whose tokens are gone is read again from the kept state above it. So a
 * text of a million lines, all read, holds some thirty thousand states
 * and a few thousand lines' tokens.
 *
 * After an edit, lines before it keep everything; reading resumes at the
 * edited line and stops as soon as a line after the edit starts in the
 * same state as before, because from there on nothing can differ. Typing
 * inside a function rereads one line; opening a comment rereads up to
 * where it closes.
 *
 * Lines are read only when asked for (the ones in view and those before
 * them); the rest wait for idle time, or come from a worker through
 * `adopt`, so opening a long file costs nothing up front.
 */
export class CodeHighlighter<S = unknown> {
  readonly tabSize: number
  private readonly interval: number
  private readonly cacheSize: number

  /** Kept start states: `lines[k]` starts in `states[k]`; the first is line 0. */
  private lines: number[] = [0]
  private states: S[]
  /** Lines above this index are read; `tip` is the state line `read` starts in. */
  private read = 0
  private tip: S

  /**
   * What was read past an edit, moved to where those lines are now. Once
   * reading reaches one of these lines in the same state, everything up to
   * `oldEnd` (which starts in `oldTip`) is read again for free.
   */
  private oldLines: number[] = []
  private oldStates: S[] = []
  private oldAt = 0
  private oldEnd = -1
  private oldTip: S | undefined

  /** Where reading again from a kept state last got to, so going down line by line doesn't start over each time. */
  private walk: { line: number; state: S } | null = null

  /** Tokens by line index, oldest first. */
  private cache = new Map<number, CodeLineTokens>()

  constructor(
    readonly language: CodeLanguage<S>,
    private doc: CodeText,
    options: number | CodeHighlighterOptions = {},
  ) {
    const opts = typeof options === 'number' ? { tabSize: options } : options
    this.tabSize = opts.tabSize ?? 2
    this.interval = Math.max(1, opts.interval ?? INTERVAL)
    this.cacheSize = Math.max(1, opts.cache ?? CACHE)
    this.tip = language.startState()
    this.states = [this.tip]
  }

  /** How many lines from the top are read. */
  get frontier(): number {
    return this.read
  }

  /** The text being read. */
  get text(): CodeText {
    return this.doc
  }

  /** Takes in a new text, made from the old one by `changes`. Without them, starts over. */
  update(doc: CodeText, changes?: ChangeSet): void {
    const old = this.doc
    this.doc = doc
    if (!changes || changes.empty) {
      if (!changes) this.reset()
      return
    }
    const list = changes.changes
    const first = list[0]!
    const last = list[list.length - 1]!
    // Line indices touched in the old text, and where they end in the new one.
    const a = old.lineAt(first.from).number - 1
    const b = old.lineAt(last.to).number - 1
    const end = doc.lineAt(changes.mapPos(last.to, 1)).number - 1
    const delta = end - b

    for (const key of this.cache.keys()) if (key >= a) this.cache.delete(key)
    if (this.walk && this.walk.line > a) this.walk = null

    const movedLines: number[] = []
    const movedStates: S[] = []
    let endLine = -1
    let endTip: S | undefined
    const move = (line: number, state: S) => {
      if (line > b) {
        movedLines.push(line + delta)
        movedStates.push(state)
      }
    }

    if (a < this.read) {
      // What was read after the edit becomes old, to compare the new reading with.
      if (b + 1 < this.read) {
        // The line right after the edit, so typing on one line stops at the next.
        const at = this.lines[this.keptAt(b + 1)]!
        if (at !== b + 1) move(b + 1, this.stateIn(old, b + 1))
      }
      for (let k = 0; k < this.lines.length; k++) move(this.lines[k]!, this.states[k]!)
      // What was still to be taken back past `read` doesn't follow on from the new
      // reading, so it goes; reading through the edit ends at the old `read`.
      if (this.read > b) {
        endLine = this.read + delta
        endTip = this.tip
      }
      // Reading starts again at the last kept state at or above the edit.
      const keep = this.keptAt(a) + 1
      this.lines.length = keep
      this.states.length = keep
      this.read = this.lines[keep - 1]!
      this.tip = this.states[keep - 1]!
    } else if (this.oldEnd >= 0) {
      // Only what is still to be taken back can be touched.
      const lines = this.oldLines
      if (this.oldAt < lines.length && lines[this.oldAt]! <= a && a < this.oldEnd) {
        // An edit among those lines: the ones above it can still be taken back, up to the last one.
        for (let k = this.oldAt; k < lines.length && lines[k]! <= a; k++) {
          movedLines.push(lines[k]!)
          movedStates.push(this.oldStates[k]!)
        }
      } else {
        for (let k = this.oldAt; k < lines.length; k++) move(lines[k]!, this.oldStates[k]!)
        if (this.oldEnd > b) {
          endLine = this.oldEnd + delta
          endTip = this.oldTip
        } else if (this.oldEnd <= a) {
          endLine = this.oldEnd
          endTip = this.oldTip
        }
      }
    } else return

    // Without its last line, the last state taken back ends it.
    if (endLine < 0 && movedLines.length) {
      endLine = movedLines.pop()!
      endTip = movedStates.pop()
    }
    this.oldLines = movedLines
    this.oldStates = movedStates
    this.oldAt = 0
    this.oldEnd = endLine > this.read && endLine <= doc.lines ? endLine : -1
    this.oldTip = this.oldEnd >= 0 ? endTip : undefined
    if (this.oldEnd < 0) this.dropOld()
  }

  private reset() {
    this.tip = this.language.startState()
    this.lines = [0]
    this.states = [this.tip]
    this.read = 0
    this.cache.clear()
    this.walk = null
    this.dropOld()
  }

  private dropOld() {
    this.oldLines = []
    this.oldStates = []
    this.oldAt = 0
    this.oldEnd = -1
    this.oldTip = undefined
  }

  /** The index of the last kept state at or above line `i`. */
  private keptAt(i: number): number {
    let lo = 0
    let hi = this.lines.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (this.lines[mid]! <= i) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  /** Where to start reading line `i` again from: a kept state, or where the last such reading got to. */
  private from(i: number): { line: number; state: S } {
    const k = this.keptAt(i)
    const walk = this.walk
    if (walk && walk.line <= i && walk.line >= this.lines[k]!)
      return { line: walk.line, state: this.language.copyState(walk.state) }
    return { line: this.lines[k]!, state: this.language.copyState(this.states[k]!) }
  }

  /** The state line `i` starts in, read from the kept state above it in `doc`. */
  private stateIn(doc: CodeText, i: number): S {
    if (doc !== this.doc) {
      const k = this.keptAt(i)
      const state = this.language.copyState(this.states[k]!)
      for (let j = this.lines[k]!; j < i; j++)
        tokenizeLine(this.language, doc.lineText(j + 1), state, this.tabSize)
      return state
    }
    const start = this.from(i)
    const state = start.state
    for (let j = start.line; j < i; j++)
      tokenizeLine(this.language, doc.lineText(j + 1), state, this.tabSize)
    this.walk = { line: i, state }
    return state
  }

  private remember(i: number, tokens: CodeLineTokens) {
    this.cache.delete(i)
    this.cache.set(i, tokens)
    if (this.cache.size > this.cacheSize) this.cache.delete(this.cache.keys().next().value!)
  }

  /** Reads the next unread line, keeping its tokens with `keep`. */
  private step(keep: boolean) {
    const i = this.read
    const state = this.language.copyState(this.tip)
    const tokens = tokenizeLine(this.language, this.doc.lineText(i + 1), state, this.tabSize)
    if (keep) this.remember(i, tokens)
    const next = i + 1
    if (this.oldEnd >= 0) {
      const lines = this.oldLines
      while (this.oldAt < lines.length && lines[this.oldAt]! < next) this.oldAt++
      const same =
        next === this.oldEnd
          ? this.language.sameState(state, this.oldTip!)
          : lines[this.oldAt] === next &&
            this.language.sameState(state, this.oldStates[this.oldAt]!)
      if (same) {
        // Same state as before the edit: everything up to `oldEnd` stands.
        if (next - this.lines[this.lines.length - 1]! >= this.interval) {
          this.lines.push(next)
          this.states.push(state)
        }
        for (let k = this.oldAt; k < lines.length; k++) {
          if (lines[k]! <= next) continue
          this.lines.push(lines[k]!)
          this.states.push(this.oldStates[k]!)
        }
        this.read = this.oldEnd
        this.tip = this.oldTip!
        this.dropOld()
        return
      }
      if (next >= this.oldEnd) this.dropOld()
    }
    if (next - this.lines[this.lines.length - 1]! >= this.interval) {
      this.lines.push(next)
      this.states.push(state)
    }
    this.read = next
    this.tip = state
  }

  /**
   * The tokens of line `n` (from 1), reading up to it if it takes no more
   * than `limit` lines; `null` when it would take more, so the caller
   * draws plain text and lets idle time catch up.
   */
  line(n: number, limit = Infinity): CodeLineTokens | null {
    const i = n - 1
    if (i < 0 || i >= this.doc.lines) return null
    const cached = this.cache.get(i)
    if (cached) return cached
    if (i < this.read) {
      // Read again from the kept state above it.
      const start = this.from(i)
      const state = start.state
      let tokens: CodeLineTokens = []
      for (let j = start.line; j <= i; j++) {
        tokens = tokenizeLine(this.language, this.doc.lineText(j + 1), state, this.tabSize)
        this.remember(j, tokens)
      }
      this.walk = { line: i + 1, state }
      return tokens
    }
    if (i - this.read > limit) return null
    // the lines just above it are likely drawn too
    const near = i - Math.min(this.cacheSize >> 1, 256)
    while (this.read <= i) this.step(this.read >= near)
    return this.cache.get(i) ?? null
  }

  /** The state at the start of line `n`, reading up to it. */
  stateAt(n: number): S {
    const i = Math.min(Math.max(n - 1, 0), this.doc.lines - 1)
    if (i === this.read) return this.tip
    if (i < this.read) return this.stateIn(this.doc, i)
    while (this.read < i) this.step(false)
    return this.tip
  }

  /** The language active at the start of line `n`: an inner one inside a nesting language. */
  languageAt(n: number): CodeLanguage {
    let language: CodeLanguage = this.language
    let state: unknown = this.stateAt(n)
    // A nested language may itself nest, e.g. Markdown → HTML → script.
    for (let depth = 0; depth < 4; depth++) {
      const inner = language.languageAt(state)
      if (!inner) break
      const innerState = (state as { inner?: { state: unknown } }).inner?.state
      language = inner
      state = innerState
    }
    return language
  }

  /** Reads ahead until `deadline` (a `performance.now()` time) or line `until`; returns whether it read any. */
  work(deadline: number, until = this.doc.lines): boolean {
    const end = Math.min(until, this.doc.lines)
    const start = this.read
    while (this.read < end) {
      this.step(false)
      // the clock is read every few lines: it costs more than a short line
      if ((this.read & 15) === 0 && performance.now() >= deadline) break
    }
    return this.read > start
  }

  /** Whether every line up to `n` is read. */
  ready(n: number): boolean {
    return this.read >= Math.min(n, this.doc.lines)
  }

  /**
   * The kept start states from line `from` (an index) on, as
   * `[line, state]` pairs, ending with the line reading is at.
   */
  checkpoints(from = 0): Array<[line: number, state: S]> {
    const out: Array<[number, S]> = []
    for (let k = this.keptAt(from); k < this.lines.length; k++)
      if (this.lines[k]! >= from) out.push([this.lines[k]!, this.states[k]!])
    if (this.read > (out.length ? out[out.length - 1]![0] : -1)) out.push([this.read, this.tip])
    return out
  }

  /**
   * Takes in start states read elsewhere (a worker reading the same text):
   * `[line, state]` pairs in order, the last one where that reading is.
   * Those past what is read here are kept as read.
   */
  adopt(points: ReadonlyArray<readonly [line: number, state: S]>): void {
    if (!points.length) return
    const [endLine, endState] = points[points.length - 1]!
    if (endLine <= this.read || endLine > this.doc.lines) return
    // Only states after a kept one here, so each line keeps one reading.
    const after = this.read
    // The state at `read` is known here; ones before it must match it.
    let k = 0
    while (k < points.length && points[k]![0] <= after) k++
    const kept = this.lines[this.lines.length - 1]!
    let last = kept
    for (; k < points.length - 1; k++) {
      const [line, state] = points[k]!
      if (line - last < this.interval) continue
      this.lines.push(line)
      this.states.push(state)
      last = line
    }
    for (const key of this.cache.keys()) if (key >= after) this.cache.delete(key)
    this.read = endLine
    this.tip = endState
    this.dropOld()
  }
}
