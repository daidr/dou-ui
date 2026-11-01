import { type CodeLanguage, type CodeTokenType, defineCodeLanguage } from '../language/language'
import type { CodeStream } from '../language/stream'

export interface PythonState {
  /** The quotes of a triple-quoted string still open at the line's end, e.g. `"""`. */
  string: string | null
  /** What the last name was a definition of: the next name is its name. */
  define: 'def' | 'class' | null
}

const KEYWORDS = new Set(
  'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case type'.split(
    ' ',
  ),
)
const CONSTANTS = new Set(['True', 'False', 'None', 'Ellipsis', 'NotImplemented'])
const BUILTIN_TYPES = new Set(
  'int float complex str bytes bytearray bool list tuple dict set frozenset object type range memoryview Exception'.split(
    ' ',
  ),
)

/** Reads a string from its quotes to their end, or to the line's end; returns whether it closed. */
function readString(stream: CodeStream, quote: string, raw: boolean): boolean {
  while (!stream.eol()) {
    if (stream.match(quote)) return true
    const ch = stream.next()
    if (ch === '\\' && !raw) stream.next()
  }
  // a one-line string ends with its line anyway
  return quote.length === 1
}

/** Python 3, with type hints, decorators and f-strings. */
export const python: CodeLanguage<PythonState> = defineCodeLanguage<PythonState>({
  name: 'python',
  aliases: ['py', 'py3', 'pyi'],
  startState: () => ({ string: null, define: null }),
  copyState: (state) => ({ ...state }),
  sameState: (a, b) => a.string === b.string && a.define === b.define,
  token(stream, state): CodeTokenType | null {
    if (state.string) {
      if (readString(stream, state.string, false)) state.string = null
      return 'string'
    }
    if (stream.eatSpace()) return null
    if (stream.eat('#')) {
      stream.skipToEnd()
      return 'comment'
    }
    // strings, with any of the prefixes r, b, f, u (and their pairs)
    const quoted = stream.match(/^([rRbBfFuU]{0,2})("""|'''|"|')/)
    if (quoted) {
      const quote = quoted[2]!
      const raw = /r/i.test(quoted[1]!)
      if (!readString(stream, quote, raw)) state.string = quote
      state.define = null
      return 'string'
    }
    if (stream.sol() && stream.match(/^@[\w.]+/)) return 'meta'
    if (stream.match(/^(?:0[xX][\da-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+)/)) return 'number'
    if (stream.match(/^(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?[jJ]?/)) return 'number'
    const word = stream.match(/^[\p{L}_][\p{L}\p{N}_]*/u)
    if (word) {
      const name = word[0]
      if (state.define) {
        const kind = state.define
        state.define = null
        return kind === 'def' ? 'function' : 'type'
      }
      if (KEYWORDS.has(name)) {
        // `match` and `type` are only keywords at the start of a statement
        if ((name === 'match' || name === 'case' || name === 'type') && !atStatement(stream))
          return stream.match(/^\s*\(/, false) ? 'function' : 'variable'
        if (name === 'def' || name === 'class') state.define = name
        return 'keyword'
      }
      if (CONSTANTS.has(name)) return 'keyword'
      if (name === 'self' || name === 'cls') return 'variable'
      if (stream.match(/^\s*\(/, false)) return 'function'
      if (BUILTIN_TYPES.has(name) || /^[A-Z][a-z]/.test(name)) return 'type'
      const before = stream.string.slice(0, stream.start).trimEnd()
      if (before.endsWith('.')) return 'property'
      return 'variable'
    }
    if (stream.match(/^(?:\*\*=?|\/\/=?|->|:=|<<=?|>>=?|[-+*/%@&|^~<>!=]=?)/)) return 'operator'
    if (stream.eat(/[()[\]{},:;.]/)) return 'punctuation'
    stream.next()
    return null
  },
  comment: { line: '#' },
  indentAfter: /:\s*(?:#.*)?$/,
})

/** Whether the word just read starts a statement and is followed by more, as `match x:` is. */
function atStatement(stream: CodeStream) {
  return /^\s*$/.test(stream.string.slice(0, stream.start)) && /^\s+[^\s=:.(,)]/.test(stream.rest())
}
