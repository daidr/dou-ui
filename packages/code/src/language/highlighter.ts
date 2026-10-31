import type { ChangeSet } from '../core/changes'
import type { CodeText } from '../core/text'
import { type CodeLanguage, type CodeLineTokens, tokenizeLine } from './language'

/**
 * Keeps the tokens of a text up to date as it changes.
 *
 * It remembers the state at the start of every line it has read. After an
 * edit, lines before the edit keep everything; reading resumes at the
 * edited line and stops as soon as a line after the edit starts in the
 * same state as before, because from there on nothing can differ. Typing
 * inside a function rereads one line; opening a comment rereads up to
 * where it closes.
 *
 * Lines are read only when asked for (the ones in view and those before
 * them); the rest wait for idle time, so opening a long file costs
 * nothing up front.
 */
export class CodeHighlighter<S = unknown> {
  /** The state at the start of each line, by line index (from 0). */
  private starts: (S | undefined)[]
  private tokens: (CodeLineTokens | undefined)[]
  /** Lines below this index have a known start state and tokens. */
  private known = 1
  /**
   * After an edit, lines from `resume` up to `stale` still hold what they
   * had before (shifted); once reading reaches `resume` and finds an
   * unchanged start state, all of them are known again.
   */
  private resume = 0
  private stale = 0

  constructor(
    readonly language: CodeLanguage<S>,
    private doc: CodeText,
    readonly tabSize = 2,
  ) {
    this.starts = [language.startState()]
    this.tokens = []
  }

  /** How many lines from the top are read. */
  get frontier(): number {
    return this.known - 1
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
    const count = end - a
    const removed = b - a
    const delta = count - removed
    // Start states of lines a+1…b are unknown now; tokens of lines a…b too.
    if (count === removed) {
      for (let i = a + 1; i <= end; i++) this.starts[i] = undefined
      for (let i = a; i <= end; i++) this.tokens[i] = undefined
    } else {
      this.starts = this.starts
        .slice(0, a + 1)
        .concat(Array.from<S | undefined>({ length: count }), this.starts.slice(b + 1))
      this.tokens = this.tokens
        .slice(0, a)
        .concat(
          Array.from<CodeLineTokens | undefined>({ length: count + 1 }),
          this.tokens.slice(b + 1),
        )
    }
    if (a < this.known) {
      // Lines between the edit and the old frontier may still be right.
      this.stale = this.known > b + 1 ? this.known + delta : 0
      this.known = a + 1
      this.resume = end + 1
    } else if (this.stale > this.resume) {
      if (a < this.resume) {
        // An edit in the lines still to read before the old ones: those after it shift.
        this.resume = Math.max(this.resume + delta, end + 1)
        this.stale = this.stale > b + 1 ? this.stale + delta : 0
      } else {
        // An edit among the old lines: those before it can still be taken back.
        this.stale = Math.min(this.stale, a + 1)
      }
      if (this.stale <= this.resume) this.stale = 0
    }
    if (this.starts.length > doc.lines + 1) this.starts.length = doc.lines + 1
    if (this.tokens.length > doc.lines) this.tokens.length = doc.lines
  }

  private reset() {
    this.starts = [this.language.startState()]
    this.tokens = []
    this.known = 1
    this.resume = 0
    this.stale = 0
  }

  /** Reads the next unread line. */
  private step() {
    const i = this.known - 1
    const state = this.language.copyState(this.starts[i]!)
    this.tokens[i] = tokenizeLine(this.language, this.doc.line(i + 1).text, state, this.tabSize)
    const next = i + 1
    if (
      next >= this.resume &&
      next < this.stale &&
      this.starts[next] !== undefined &&
      this.language.sameState(state, this.starts[next]!)
    ) {
      // Same state as before the edit: everything up to `stale` stands.
      this.known = this.stale
      this.stale = 0
      return
    }
    this.starts[next] = state
    this.known = next + 1
    if (next >= this.stale) this.stale = 0
  }

  /**
   * The tokens of line `n` (from 1), reading up to it if it takes no more
   * than `limit` lines; `null` when it would take more, so the caller
   * draws plain text and lets idle time catch up.
   */
  line(n: number, limit = Infinity): CodeLineTokens | null {
    const i = n - 1
    if (i < 0 || i >= this.doc.lines) return null
    if (i < this.known - 1) return this.tokens[i] ?? null
    if (i - (this.known - 1) > limit) return null
    while (this.known - 1 <= i) this.step()
    return this.tokens[i] ?? null
  }

  /** The state at the start of line `n`, reading up to it. */
  stateAt(n: number): S {
    const i = Math.min(Math.max(n - 1, 0), this.doc.lines - 1)
    while (this.known - 1 < i) this.step()
    return this.starts[i]!
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
    let read = false
    while (this.known - 1 < Math.min(until, this.doc.lines)) {
      this.step()
      read = true
      if (performance.now() >= deadline) break
    }
    return read
  }

  /** Whether every line up to `n` is read. */
  ready(n: number): boolean {
    return this.known - 1 >= Math.min(n, this.doc.lines)
  }
}
