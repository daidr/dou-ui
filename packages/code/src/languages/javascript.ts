import { type CodeLanguage, type CodeTokenType, defineCodeLanguage } from '../language/language'
import type { CodeStream } from '../language/stream'

const words = (list: string) => new Set(list.split(' '))

const KEYWORDS = words(
  'as async await break case catch class const continue debugger default delete do else export extends false finally for from function get if import in instanceof let new null of return set static super switch this throw true try typeof undefined var void while with yield',
)
const TS_KEYWORDS = words(
  'abstract asserts declare enum global implements infer interface is keyof module namespace override private protected public readonly satisfies type unique',
)
const TS_TYPES = words('any bigint boolean never number object string symbol unknown void')
/** After these a `/` starts a regular expression, not a division. */
const BEFORE_EXPRESSION = words(
  'await case delete do else in instanceof new of return throw typeof void yield',
)

/**
 * Where the tokenizer is, as a string of one character per open context
 * (a string compares fastest):
 *
 * - `{` a brace block, `$` a `${…}` in a template string, `` ` `` inside a template string
 * - `<` inside a JSX tag (its attributes), `>` among a JSX element's children, `J` a `{…}` in JSX
 */
export interface JavaScriptState {
  stack: string
  /** Inside a `/* … *\/` comment. */
  comment: boolean
  /** An expression may start here: a `/` is a regular expression, a `<` a JSX tag. */
  expr: boolean
  /** The token before was a `.`, so a name is a property. */
  dot: boolean
  /** The token before opened a brace or was a comma inside one, so `name:` is a property. */
  key: boolean
}

export interface JavaScriptOptions {
  typescript?: boolean
  jsx?: boolean
}

const IDENT = /^[\p{L}_$][\p{L}\p{N}_$]*/u
const NUMBER =
  /^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?)n?/

function readString(stream: CodeStream, quote: string) {
  let escaped = false
  let ch: string | undefined
  while ((ch = stream.next()) !== undefined) {
    if (ch === quote && !escaped) return
    escaped = !escaped && ch === '\\'
  }
}

function readRegex(stream: CodeStream) {
  let escaped = false
  let inClass = false
  let ch: string | undefined
  while ((ch = stream.next()) !== undefined) {
    if (escaped) escaped = false
    else if (ch === '\\') escaped = true
    else if (ch === '[') inClass = true
    else if (ch === ']') inClass = false
    else if (ch === '/' && !inClass) {
      stream.match(/^[dgimsuvy]*/)
      return
    }
  }
}

const top = (state: JavaScriptState) => state.stack[state.stack.length - 1]
const pop = (state: JavaScriptState) => {
  state.stack = state.stack.slice(0, -1)
}

/** Reads a token inside a JSX tag's attributes. */
function jsxTag(stream: CodeStream, state: JavaScriptState): CodeTokenType | null {
  if (stream.eatSpace()) return null
  if (stream.match('/>')) {
    pop(state)
    state.expr = false
    return 'tag'
  }
  if (stream.eat('>')) {
    state.stack = state.stack.slice(0, -1) + '>'
    return 'tag'
  }
  if (stream.eat('{')) {
    state.stack += 'J'
    state.expr = true
    return 'punctuation'
  }
  const quote = stream.eat(/["']/)
  if (quote) {
    readString(stream, quote)
    return 'string'
  }
  if (stream.match(/^[\p{L}_$][\p{L}\p{N}_$:.-]*/u)) return 'attribute'
  if (stream.eat('=')) return 'operator'
  stream.next()
  return null
}

/** Reads a token among a JSX element's children. */
function jsxChildren(stream: CodeStream, state: JavaScriptState): CodeTokenType | null {
  if (stream.match(/^<\/[\p{L}\p{N}_$:.-]*\s*>?/u)) {
    pop(state)
    state.expr = false
    return 'tag'
  }
  if (stream.match(/^<[\p{L}_$>]/u, false)) return openTag(stream, state)
  if (stream.eat('{')) {
    state.stack += 'J'
    state.expr = true
    return 'punctuation'
  }
  stream.eatWhile((ch) => ch !== '<' && ch !== '{')
  return null
}

function openTag(stream: CodeStream, state: JavaScriptState): CodeTokenType {
  stream.next()
  // `<>` opens a fragment straight among its children.
  if (stream.eat('>')) state.stack += '>'
  else {
    stream.match(/^[\p{L}_$][\p{L}\p{N}_$:.-]*/u)
    state.stack += '<'
  }
  return 'tag'
}

function templateBody(stream: CodeStream, state: JavaScriptState): CodeTokenType | null {
  if (stream.eat('`')) {
    pop(state)
    state.expr = false
    return 'string'
  }
  if (stream.match('${')) {
    state.stack += '$'
    state.expr = true
    return 'punctuation'
  }
  let escaped = false
  while (!stream.eol()) {
    const ch = stream.peek()!
    if (!escaped && (ch === '`' || (ch === '$' && stream.string[stream.pos + 1] === '{'))) break
    escaped = !escaped && ch === '\\'
    stream.next()
  }
  return 'string'
}

function code(
  stream: CodeStream,
  state: JavaScriptState,
  options: JavaScriptOptions,
): CodeTokenType | null {
  if (stream.eatSpace()) return null
  const ch = stream.peek()!
  const dot = state.dot
  // A name opening a line inside braces may be a key too: members of a type, one per line.
  const key = state.key || (stream.sol() && top(state) === '{')
  state.dot = false
  state.key = false

  if (ch === '/') {
    if (stream.match('//')) {
      stream.skipToEnd()
      return 'comment'
    }
    if (stream.match('/*')) {
      state.comment = !stream.skipTo('*/')
      if (!state.comment) stream.pos += 2
      else stream.skipToEnd()
      return 'comment'
    }
    if (state.expr) {
      stream.next()
      readRegex(stream)
      state.expr = false
      return 'string'
    }
  }
  if (ch === '"' || ch === "'") {
    stream.next()
    readString(stream, ch)
    // A quoted key: `{ 'a': 1 }`.
    const isKey = key && !!stream.match(/^\s*:/, false)
    state.expr = false
    return isKey ? 'property' : 'string'
  }
  if (ch === '`') {
    stream.next()
    state.stack += '`'
    return 'string'
  }
  if (/\d/.test(ch) || (ch === '.' && /\d/.test(stream.string[stream.pos + 1] ?? ''))) {
    if (stream.match(NUMBER)) {
      state.expr = false
      return 'number'
    }
  }
  if (options.jsx && ch === '<' && state.expr && stream.match(/^<[\p{L}_$>]/u, false))
    return openTag(stream, state)

  const word = stream.match(IDENT)
  if (word) {
    const name = word[0]
    const ahead = (pattern: RegExp) => !!stream.match(pattern, false)
    state.expr = BEFORE_EXPRESSION.has(name)
    if (dot) return ahead(/^\s*\(/) ? 'function' : 'property'
    if (key && ahead(/^\s*\??:(?!:)/)) return 'property'
    if (KEYWORDS.has(name)) {
      // `get`, `set`, `from`, `as`, `of` are only keywords in some places; as names they stay names.
      if (/^(?:get|set|from|as|of|async)$/.test(name) && ahead(/^\s*[(=:,;)]/))
        return ahead(/^\s*\(/) ? 'function' : 'variable'
      return 'keyword'
    }
    if (options.typescript) {
      if (TS_TYPES.has(name)) return 'type'
      if (TS_KEYWORDS.has(name) && !ahead(/^\s*[(=:,;.)]/)) return 'keyword'
    }
    if (ahead(/^\s*(?:\?\.)?\(/) || ahead(/^\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>/))
      return 'function'
    if (/^[A-Z]/.test(name)) return 'type'
    return 'variable'
  }
  if (ch === '#') {
    stream.next()
    if (stream.match(IDENT)) {
      state.expr = false
      return 'property'
    }
    return 'meta'
  }
  if (ch === '@') {
    stream.next()
    stream.match(/^[\p{L}_$][\p{L}\p{N}_$.]*/u)
    return 'meta'
  }

  stream.next()
  if (ch === '{') {
    state.stack += '{'
    state.expr = true
    state.key = true
    return 'punctuation'
  }
  if (ch === '}') {
    const t = top(state)
    if (t === '{' || t === '$' || t === 'J') pop(state)
    state.expr = false
    return 'punctuation'
  }
  if (ch === '(' || ch === '[') {
    state.expr = true
    return 'punctuation'
  }
  if (ch === ')' || ch === ']') {
    state.expr = false
    return 'punctuation'
  }
  if (ch === ',' || ch === ';') {
    state.expr = true
    // A comma, or a semicolon in a type, starts the next key in braces.
    state.key = top(state) === '{'
    return 'punctuation'
  }
  if (ch === '.') {
    if (stream.match('..')) {
      state.expr = true
      return 'operator'
    }
    state.dot = true
    return 'punctuation'
  }
  if (ch === '?' && stream.peek() === '.' && !/\d/.test(stream.string[stream.pos + 1] ?? '')) {
    stream.next()
    state.dot = true
    return 'operator'
  }
  if (/[+\-*/%=&|^!<>?~:]/.test(ch)) {
    stream.eatWhile(/[+\-*/%=&|^!<>?~:]/)
    // `x++` and `x--` end an expression; other operators start one.
    state.expr = !/^(?:\+\+|--)$/.test(stream.current())
    return 'operator'
  }
  state.expr = false
  return null
}

/** Makes a JavaScript-family language: plain, TypeScript, JSX or TSX. */
export function createJavaScript(
  name: string,
  aliases: string[],
  options: JavaScriptOptions = {},
): CodeLanguage<JavaScriptState> {
  return defineCodeLanguage<JavaScriptState>({
    name,
    aliases,
    startState: () => ({ stack: '', comment: false, expr: true, dot: false, key: false }),
    copyState: (state) => ({ ...state }),
    sameState: (a, b) =>
      a.stack === b.stack &&
      a.comment === b.comment &&
      a.expr === b.expr &&
      a.dot === b.dot &&
      a.key === b.key,
    token(stream, state) {
      if (state.comment) {
        if (stream.skipTo('*/')) {
          stream.pos += 2
          state.comment = false
        } else stream.skipToEnd()
        return 'comment'
      }
      const t = top(state)
      if (t === '`') return templateBody(stream, state)
      if (t === '<') return jsxTag(stream, state)
      if (t === '>') return jsxChildren(stream, state)
      return code(stream, state, options)
    },
    comment: { line: '//', block: ['/*', '*/'] },
    closeBrackets: '([{\'"`',
  })
}

export const javascript = createJavaScript('javascript', ['js', 'mjs', 'cjs'])
export const typescript = createJavaScript('typescript', ['ts', 'mts', 'cts'], {
  typescript: true,
})
export const jsx = createJavaScript('jsx', [], { jsx: true })
export const tsx = createJavaScript('tsx', [], { typescript: true, jsx: true })
