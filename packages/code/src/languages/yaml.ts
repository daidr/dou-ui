import { type CodeLanguage, type CodeTokenType, defineCodeLanguage } from '../language/language'

export interface YamlState {
  /**
   * Reading a block scalar (`|` or `>`): the indentation of the line that
   * started it; lines indented further are its text. `-1` outside one.
   */
  block: number
  /** The quote of a string still open at the line's end. */
  quote: '"' | "'" | null
  /** Open `[` and `{` of flow collections. */
  flow: number
}

const SCALAR = /^(?:true|false|yes|no|on|off|null|~)$/i
const NUMBER =
  /^[-+]?(?:\d[\d_]*(?:\.\d*)?(?:[eE][-+]?\d+)?|\.\d+|0x[\da-fA-F]+|0o[0-7]+|\.inf|\.nan)$/i

/** YAML, as in configuration files and front matter. */
export const yaml: CodeLanguage<YamlState> = defineCodeLanguage<YamlState>({
  name: 'yaml',
  aliases: ['yml'],
  startState: () => ({ block: -1, quote: null, flow: 0 }),
  copyState: (state) => ({ ...state }),
  sameState: (a, b) => a.block === b.block && a.quote === b.quote && a.flow === b.flow,
  token(stream, state): CodeTokenType | null {
    if (stream.pos === 0 && state.block >= 0) {
      if (stream.indentation() > state.block || !stream.string.trim()) {
        stream.skipToEnd()
        return 'string'
      }
      state.block = -1
    }
    if (state.quote) {
      const quote = state.quote
      while (!stream.eol()) {
        const ch = stream.next()
        if (ch === '\\' && quote === '"') stream.next()
        else if (ch === quote) {
          if (quote === "'" && stream.eat("'")) continue
          state.quote = null
          break
        }
      }
      return 'string'
    }
    if (stream.pos === 0 && stream.match(/^(?:---|\.\.\.)(?=\s|$)/)) return 'meta'
    if (stream.eatSpace()) return null
    const ch = stream.peek()!
    if (ch === '#' && (stream.pos === 0 || /\s/.test(stream.string[stream.pos - 1]!))) {
      stream.skipToEnd()
      return 'comment'
    }
    if (ch === '"' || ch === "'") {
      stream.next()
      state.quote = ch
      const type = yaml.token(stream, state) ?? 'string'
      // a quoted key
      return stream.match(/^\s*:(?=\s|$)/, false) ? 'property' : type
    }
    if (stream.match(/^-(?=\s|$)/)) return 'punctuation'
    if (stream.match(/^[&*][^\s,[\]{}]+/)) return 'variable'
    if (stream.match(/^!{1,2}[^\s,[\]{}]*/)) return 'meta'
    // a block scalar starts: the lines indented under this one are its text
    if (stream.match(/^[|>][-+]?\d?(?=\s*(?:#.*)?$)/)) {
      state.block = stream.indentation()
      return 'operator'
    }
    if (stream.eat(/[[{]/)) {
      state.flow++
      return 'punctuation'
    }
    if (stream.eat(/[\]}]/)) {
      state.flow = Math.max(0, state.flow - 1)
      return 'punctuation'
    }
    if (stream.eat(',') && state.flow) return 'punctuation'
    if (stream.match(/^:(?=\s|$)/) || (state.flow && stream.eat(':'))) return 'punctuation'
    // a key: plain text up to `: `
    if (stream.match(/^[^\s#,[\]{}:][^#,[\]{}]*?(?=\s*:(?:\s|$))/)) return 'property'
    // a plain value runs to a comment or the line's end (inside [ ] or { }, to a , too)
    const value = stream.match(
      state.flow ? /^[^,[\]{}#]+?(?=\s*(?:[,\]}]|#|$))/ : /^.+?(?=\s+#|\s*$)/,
    )
    if (value) {
      const text = value[0].trim()
      if (SCALAR.test(text)) return 'keyword'
      if (NUMBER.test(text)) return 'number'
      return 'string'
    }
    stream.next()
    return null
  },
  comment: { line: '#' },
  brackets: '[]{}',
  autoClose: '[{\'"',
  indentAfter: /:\s*(?:[|>][-+]?\d?)?\s*(?:#.*)?$/,
})
