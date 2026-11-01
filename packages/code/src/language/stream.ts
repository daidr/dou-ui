/**
 * A cursor over one line, handed to a language's `token` function. The
 * function reads one token from `pos` onward (at least one character) and
 * returns its kind; whatever it read becomes that token.
 */
export class CodeStream {
  /** Where the current token starts. */
  start = 0
  /** Where reading continues. */
  pos = 0
  /** Where this stream ends; a nesting language ends it early, e.g. at `</script>`. */
  end: number

  constructor(
    /** The whole line. */
    readonly string: string,
    /** Columns per tab stop, for `indentation()`. */
    readonly tabSize = 2,
  ) {
    this.end = string.length
  }

  /** Whether the line is read to its end. */
  eol(): boolean {
    return this.pos >= this.end
  }

  /** Whether the stream is at the line's first character that isn't whitespace. */
  sol(): boolean {
    for (let i = this.pos - 1; i >= 0; i--) {
      const code = this.string.charCodeAt(i)
      // as `\s`: tab to carriage return and space, other spaces (the CJK one too) by the regex
      if (code === 32 || (code >= 9 && code <= 13)) continue
      if (code < 128 || !SPACE.test(this.string[i]!)) return false
    }
    return true
  }

  /** The next character, without reading it. */
  peek(): string | undefined {
    return this.pos < this.end ? this.string[this.pos] : undefined
  }

  /** Reads and returns the next character. */
  next(): string | undefined {
    return this.pos < this.end ? this.string[this.pos++] : undefined
  }

  /** Reads the next character if it is `match` (a character, a set as a regex, or a test). */
  eat(match: string | RegExp | ((ch: string) => boolean)): string | undefined {
    const ch = this.peek()
    if (ch === undefined) return undefined
    const ok =
      typeof match === 'string'
        ? ch === match
        : match instanceof RegExp
          ? match.test(ch)
          : match(ch)
    if (!ok) return undefined
    this.pos++
    return ch
  }

  /** Reads characters while they match; returns whether it read any. */
  eatWhile(match: string | RegExp | ((ch: string) => boolean)): boolean {
    const from = this.pos
    while (this.eat(match) !== undefined) {
      // keep reading
    }
    return this.pos > from
  }

  /** Reads whitespace. */
  eatSpace(): boolean {
    return this.eatWhile(isSpace)
  }

  /** Reads to the end of the stream. */
  skipToEnd(): void {
    this.pos = this.end
  }

  /** Reads up to (not including) the next `text`; returns whether it was found. */
  skipTo(text: string): boolean {
    const at = this.string.indexOf(text, this.pos)
    if (at < 0 || at >= this.end) return false
    this.pos = at
    return true
  }

  /**
   * Reads `pattern` if the line continues with it. A string matches as is
   * (`caseInsensitive` ignores case); a regex must start with `^` and
   * returns its match. `consume: false` only looks.
   */
  match(pattern: string, consume?: boolean, caseInsensitive?: boolean): boolean
  match(pattern: RegExp, consume?: boolean): RegExpMatchArray | null
  match(
    pattern: string | RegExp,
    consume = true,
    caseInsensitive = false,
  ): boolean | RegExpMatchArray | null {
    if (typeof pattern === 'string') {
      if (this.pos + pattern.length > this.end) return false
      const ok = caseInsensitive
        ? this.string.slice(this.pos, this.pos + pattern.length).toLowerCase() ===
          pattern.toLowerCase()
        : this.string.startsWith(pattern, this.pos)
      if (ok && consume) this.pos += pattern.length
      return ok
    }
    // Matched against the rest of the line: slicing a string doesn't copy it, and a
    // pattern written inside a tokenizer (a new object each time) needs no preparing.
    const rest =
      this.pos || this.end < this.string.length
        ? this.string.slice(this.pos, this.end)
        : this.string
    if (pattern.global || pattern.sticky) pattern.lastIndex = 0
    let found: RegExpMatchArray | null = pattern.exec(rest)
    if (pattern.global || pattern.sticky) pattern.lastIndex = 0
    if (found && found.index !== 0) found = null
    if (!found) return null
    if (consume) this.pos += found[0].length
    return found
  }

  /** Steps back `n` characters. */
  backUp(n: number): void {
    this.pos -= n
  }

  /** The text of the current token so far. */
  current(): string {
    return this.string.slice(this.start, this.pos)
  }

  /** The line's indentation in columns. */
  indentation(): number {
    let col = 0
    for (const ch of this.string) {
      if (ch === ' ') col++
      else if (ch === '\t') col = (Math.floor(col / this.tabSize) + 1) * this.tabSize
      else break
    }
    return col
  }

  /** The text after the stream, to the line's end (also past `end`). */
  rest(): string {
    return this.string.slice(this.pos)
  }
}

const SPACE = /\s/

export const isSpace = (ch: string) => ch === ' ' || ch === '\t'
