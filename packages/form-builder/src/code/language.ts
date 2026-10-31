import { defineCodeLanguage } from '@dou-ui/code'

const NAMES = new Set(['values', 'value', 'item'])
const KEYWORDS = new Set(['true', 'false', 'null', 'in'])

/**
 * The form expression language for `@dou-ui/code`: `values` and its
 * paths, strings, numbers, function calls and operators, colored as in
 * the code editor.
 */
export const formExpression = defineCodeLanguage({
  name: 'form-expression',
  token(stream) {
    if (stream.eatSpace()) return null
    if (stream.match(/^(['"])(?:\\.|(?!\1).)*\1?/)) return 'string'
    if (stream.match(/^\d+(?:\.\d+)?(?:e[+-]?\d+)?/i)) return 'number'
    const word = stream.match(/^[A-Za-z_$À-￿][\w$À-￿]*/)
    if (word) {
      const text = word[0]
      if (KEYWORDS.has(text)) return 'keyword'
      if (NAMES.has(text)) return 'variable'
      // A key after a dot, or a name called.
      if (stream.string.charAt(stream.start - 1) === '.') return 'property'
      if (/^\s*\(/.test(stream.string.slice(stream.pos))) return 'function'
      return 'invalid'
    }
    if (stream.match(/^(?:==|!=|<=|>=|&&|\|\||[<>!+\-*/%?:])/)) return 'operator'
    stream.next()
    return 'punctuation'
  },
  brackets: '()[]',
  autoClose: `(['"`,
})
