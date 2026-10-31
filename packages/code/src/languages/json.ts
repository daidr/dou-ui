import { type CodeLanguage, defineCodeLanguage } from '../language/language'

export interface JsonState {
  /** Inside a `/* … *\/` comment (JSON with comments). */
  comment: boolean
}

/** JSON, also with comments and trailing commas as in `tsconfig.json`. */
export const json: CodeLanguage<JsonState> = defineCodeLanguage<JsonState>({
  name: 'json',
  aliases: ['jsonc', 'json5'],
  startState: () => ({ comment: false }),
  copyState: (state) => ({ ...state }),
  sameState: (a, b) => a.comment === b.comment,
  token(stream, state) {
    if (state.comment || stream.match('/*')) {
      state.comment = !stream.skipTo('*/')
      if (state.comment) stream.skipToEnd()
      else stream.pos += 2
      return 'comment'
    }
    if (stream.eatSpace()) return null
    if (stream.match('//')) {
      stream.skipToEnd()
      return 'comment'
    }
    if (stream.eat('"')) {
      let escaped = false
      let ch: string | undefined
      while ((ch = stream.next()) !== undefined) {
        if (ch === '"' && !escaped) break
        escaped = !escaped && ch === '\\'
      }
      return stream.match(/^\s*:/, false) ? 'property' : 'string'
    }
    if (stream.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)) return 'number'
    if (stream.match(/^(?:true|false|null)\b/)) return 'keyword'
    if (stream.eat(/[{}[\],:]/)) return 'punctuation'
    stream.eatWhile(/[^\s{}[\],:"]/)
    return 'invalid'
  },
  comment: { line: '//', block: ['/*', '*/'] },
  closeBrackets: '[{"',
})
