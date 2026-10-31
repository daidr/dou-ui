import { type CodeLanguage, type CodeTokenType, defineCodeLanguage } from '../language/language'
import type { CodeStream } from '../language/stream'

export interface CssState {
  /** Inside a `/* … *\/` comment. */
  comment: boolean
  /** Open braces. */
  depth: number
  /** After a property's `:`, before its `;`: reading a value. */
  value: boolean
  /** Open parentheses in a value or selector, e.g. `rgb(…)` or `:is(…)`. */
  parens: number
  /** Inside an at-rule's prelude, e.g. `@media (…)`. */
  at: boolean
}

/**
 * Whether a name at the cursor inside a block is a property: `name:` with
 * a `;`, a `}` or the line's end before any `{` (`a:hover {` is a nested
 * selector).
 */
const isProperty = (stream: CodeStream) =>
  !!stream.match(/^[\w-]+\s*:(?!:)[^{;}]*(?:[;}]|$)/, false)

function readString(stream: CodeStream, quote: string) {
  let escaped = false
  let ch: string | undefined
  while ((ch = stream.next()) !== undefined) {
    if (ch === quote && !escaped) return
    escaped = !escaped && ch === '\\'
  }
}

/** Makes CSS or a nesting dialect such as SCSS (`//` comments, `$` variables). */
export function createCss(name: string, aliases: string[], scss = false): CodeLanguage<CssState> {
  return defineCodeLanguage<CssState>({
    name,
    aliases,
    startState: () => ({ comment: false, depth: 0, value: false, parens: 0, at: false }),
    copyState: (state) => ({ ...state }),
    sameState: (a, b) =>
      a.comment === b.comment &&
      a.depth === b.depth &&
      a.value === b.value &&
      a.parens === b.parens &&
      a.at === b.at,
    token(stream, state): CodeTokenType | null {
      if (state.comment || stream.match('/*')) {
        state.comment = !stream.skipTo('*/')
        if (state.comment) stream.skipToEnd()
        else stream.pos += 2
        return 'comment'
      }
      if (stream.eatSpace()) return null
      if (scss && stream.match('//')) {
        stream.skipToEnd()
        return 'comment'
      }
      const ch = stream.peek()!
      if (ch === '"' || ch === "'") {
        stream.next()
        readString(stream, ch)
        return 'string'
      }
      if (ch === '@') {
        stream.next()
        stream.match(/^[\w-]+/)
        state.at = true
        return 'keyword'
      }
      if (ch === '{') {
        stream.next()
        state.depth++
        state.value = false
        state.at = false
        return 'punctuation'
      }
      if (ch === '}') {
        stream.next()
        state.depth = Math.max(0, state.depth - 1)
        state.value = false
        return 'punctuation'
      }
      if (ch === ';') {
        stream.next()
        state.value = false
        state.at = false
        return 'punctuation'
      }
      if (ch === '(') {
        stream.next()
        state.parens++
        return 'punctuation'
      }
      if (ch === ')') {
        stream.next()
        state.parens = Math.max(0, state.parens - 1)
        return 'punctuation'
      }
      if (stream.match(/^--[\w-]*/) || (scss && stream.match(/^\$[\w-]+/))) {
        if (!state.value && stream.match(/^\s*:/, false)) return 'property'
        return 'variable'
      }
      if (state.value || state.at || state.parens) {
        if (stream.match(/^#[\da-fA-F]{3,8}\b/)) return 'number'
        if (stream.match(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?:%|[a-zA-Z]+)?/)) return 'number'
        if (stream.match('!important')) return 'keyword'
        if (stream.match(/^[\w-]+(?=\()/)) return 'function'
        if (stream.match(/^[\w-]+/)) {
          if (state.at && /^(?:and|or|not|only|screen|print|all)$/.test(stream.current()))
            return 'keyword'
          return state.value ? 'variable' : state.at ? 'variable' : 'property'
        }
      } else {
        if (state.depth > 0 && isProperty(stream)) {
          stream.match(/^[\w-]+/)
          return 'property'
        }
        if (stream.match(/^[.#][\w-]+/)) return 'type'
        if (stream.match(/^::?[\w-]+/)) return 'keyword'
        if (stream.match(/^\[[^\]]*\]?/)) return 'attribute'
        if (stream.match(/^[a-zA-Z][\w-]*/) || stream.eat('*')) return 'tag'
        if (scss && stream.eat('&')) return 'keyword'
      }
      if (ch === ':') {
        stream.next()
        if (state.depth > 0 && !state.at) state.value = true
        return 'punctuation'
      }
      if (stream.eat(/[,>+~/*=]/)) return 'operator'
      stream.next()
      return null
    },
    comment: scss ? { line: '//', block: ['/*', '*/'] } : { block: ['/*', '*/'] },
    autoClose: '([{\'"',
  })
}

export const css = createCss('css', [])
export const scss = createCss('scss', ['less', 'postcss'], true)
