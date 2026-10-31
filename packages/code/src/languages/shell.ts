import { type CodeLanguage, type CodeTokenType, defineCodeLanguage } from '../language/language'
import type { CodeStream } from '../language/stream'

export interface ShellState {
  /** The quote of a string still open at the line's end. */
  quote: '"' | "'" | null
  /** The next word is a command (at the line's start, or after `|`, `;`, `&&`, `then`…). */
  command: boolean
  /** The word that ends a here-document being read, e.g. `EOF`. */
  heredoc: string | null
}

const KEYWORDS = new Set(
  'if then else elif fi for while until do done case esac in function select time coproc'.split(
    ' ',
  ),
)
/** Keywords after which a command comes. */
const BEFORE_COMMAND = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', 'time'])
const BUILTINS = new Set(
  'echo printf read cd pwd export local readonly return exit set unset shift source eval exec trap test declare alias let true false'.split(
    ' ',
  ),
)

/** Reads a `$name`, `${…}` or `$(…)`; returns whether there was one. */
function readVariable(stream: CodeStream) {
  if (stream.match(/^\$(?:[\w@*#?$!-]|\{[^}]*\}?)/)) {
    stream.match(/^\w*/)
    return true
  }
  return false
}

/** Reads a double-quoted string up to its end or a `$`; returns whether it closed. */
function readDouble(stream: CodeStream) {
  while (!stream.eol()) {
    const ch = stream.peek()
    if (ch === '$' && stream.match(/^\$[\w{@*#?!-]/, false)) return false
    stream.next()
    if (ch === '\\') stream.next()
    else if (ch === '"') return true
  }
  return false
}

/** Shell scripts: Bash, sh and Zsh. */
export const shell: CodeLanguage<ShellState> = defineCodeLanguage<ShellState>({
  name: 'shell',
  aliases: ['sh', 'bash', 'zsh', 'shellscript'],
  startState: () => ({ quote: null, command: true, heredoc: null }),
  copyState: (state) => ({ ...state }),
  sameState: (a, b) => a.quote === b.quote && a.command === b.command && a.heredoc === b.heredoc,
  blankLine(state) {
    if (!state.quote && !state.heredoc) state.command = true
  },
  token(stream, state): CodeTokenType | null {
    if (stream.pos === 0 && !state.quote) {
      if (state.heredoc) {
        if (stream.string.trim() === state.heredoc) {
          stream.skipToEnd()
          state.heredoc = null
          state.command = true
          return 'string'
        }
        stream.skipToEnd()
        return 'string'
      }
      if (!stream.string.trimEnd().endsWith('\\')) state.command = true
    }
    if (state.quote === "'") {
      if (stream.skipTo("'")) {
        stream.next()
        state.quote = null
      } else stream.skipToEnd()
      return 'string'
    }
    if (state.quote === '"') {
      if (readVariable(stream)) return 'variable'
      if (readDouble(stream)) state.quote = null
      return 'string'
    }
    if (stream.eatSpace()) return null
    const ch = stream.peek()!
    if (ch === '#' && (stream.pos === 0 || /\s/.test(stream.string[stream.pos - 1]!))) {
      // `#!/bin/bash` on the first line is a comment too, read as such
      stream.skipToEnd()
      return 'comment'
    }
    if (ch === "'") {
      stream.next()
      if (stream.skipTo("'")) stream.next()
      else {
        stream.skipToEnd()
        state.quote = "'"
      }
      state.command = false
      return 'string'
    }
    if (ch === '"') {
      stream.next()
      state.quote = readDouble(stream) ? null : '"'
      state.command = false
      return 'string'
    }
    if (ch === '$') {
      if (stream.match('$(')) {
        state.command = true
        return 'punctuation'
      }
      if (readVariable(stream)) {
        state.command = false
        return 'variable'
      }
    }
    const heredoc = stream.match(/^<<-?\s*(['"]?)(\w+)\1/)
    if (heredoc) {
      state.heredoc = heredoc[2]!
      return 'operator'
    }
    if (stream.match(/^(?:&&|\|\||;;|[|;&])/)) {
      state.command = true
      return 'operator'
    }
    if (stream.match(/^(?:\d?>>?|<|&>)/)) return 'operator'
    if (stream.eat(/[(){}[\]]/)) {
      // `[ … ]` is the test command itself: what follows are its arguments
      state.command = ch === '(' || ch === '{'
      if (ch === '[' || ch === ']') stream.eat(ch)
      return 'punctuation'
    }
    // a variable being set: NAME=value
    if (state.command && stream.match(/^[A-Za-z_]\w*(?==)/)) return 'variable'
    if (stream.eat('=')) return 'operator'
    const word = stream.match(/^[^\s|;&<>()"'$`=]+/)
    if (word) {
      const text = word[0]
      if (KEYWORDS.has(text) && (state.command || text === 'in' || text === 'do')) {
        state.command = BEFORE_COMMAND.has(text)
        return 'keyword'
      }
      if (state.command) {
        state.command = false
        return BUILTINS.has(text) ? 'keyword' : 'function'
      }
      if (/^--?[\w-]/.test(text)) return 'attribute'
      if (/^\d+$/.test(text)) return 'number'
      return null
    }
    stream.next()
    return null
  },
  comment: { line: '#' },
  brackets: '()[]{}',
  indentAfter: /(?:\bthen|\bdo|\{|\bin)\s*(?:#.*)?$/,
})
