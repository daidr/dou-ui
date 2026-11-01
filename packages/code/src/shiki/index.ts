import { type CodeLanguage, type CodeTokenType, defineCodeLanguage } from '../language/language'

/** The part of a TextMate rule stack the editor uses: Shiki's `StateStack`. */
export interface ShikiStateStack {
  equals(other: ShikiStateStack): boolean
}

/** What the editor needs of a Shiki highlighter (`createHighlighter()` from `shiki`). */
export interface ShikiHighlighterLike {
  getLanguage(name: string): {
    tokenizeLine(
      line: string,
      state: ShikiStateStack | null,
      timeLimit?: number,
    ): {
      tokens: Array<{ startIndex: number; endIndex: number; scopes: string[] }>
      ruleStack: ShikiStateStack
      /** The time limit ran out before the end of the line. */
      stoppedEarly?: boolean
    }
  }
}

export interface ShikiLanguageOptions {
  /** The name the editor and code blocks know it by; defaults to the Shiki language's. */
  name?: string
  aliases?: string[]
  /** How the language writes comments, for toggling them; Shiki doesn't say. */
  comment?: { line?: string; block?: [open: string, close: string] }
  brackets?: string
  autoClose?: string
  indentAfter?: RegExp
  /**
   * The token kind (syntax color) for a token's scopes, outermost first;
   * return `undefined` to use the built-in mapping (`tokenTypeOfScopes`).
   */
  tokenType?: (scopes: readonly string[]) => CodeTokenType | null | undefined
}

export interface ShikiState {
  /** The grammar's state at the start of the line being read, or after the last line. */
  stack: ShikiStateStack | null
  /** The tokens of the line being read; positions from `base`. */
  line: { text: string; base: number; ends: number[]; types: Array<CodeTokenType | null> } | null
}

/** Scope prefixes and the kind each is drawn as; the first that matches a token's scopes, from the innermost scope out, wins. */
const SCOPES: Array<[prefix: string, type: CodeTokenType]> = [
  ['comment', 'comment'],
  ['punctuation.definition.comment', 'comment'],
  ['string.regexp', 'string'],
  ['constant.character.escape', 'string'],
  ['punctuation.definition.string', 'string'],
  ['string', 'string'],
  ['constant.numeric', 'number'],
  ['constant.language', 'keyword'],
  ['constant.other.color', 'number'],
  ['keyword.operator', 'operator'],
  ['storage.type.function.arrow', 'operator'],
  ['keyword', 'keyword'],
  ['storage', 'keyword'],
  ['entity.name.function', 'function'],
  ['support.function', 'function'],
  ['meta.function-call', 'function'],
  ['entity.name.tag', 'tag'],
  ['entity.other.attribute-name', 'attribute'],
  ['entity.name.type', 'type'],
  ['entity.name.class', 'type'],
  ['entity.other.inherited-class', 'type'],
  ['support.type.property-name', 'property'],
  ['support.type', 'type'],
  ['support.class', 'type'],
  ['variable.other.property', 'property'],
  ['variable.other.object.property', 'property'],
  ['support.variable.property', 'property'],
  ['meta.object-literal.key', 'property'],
  ['variable.language', 'keyword'],
  ['variable', 'variable'],
  ['entity.name', 'variable'],
  ['markup.heading', 'heading'],
  ['markup.bold', 'strong'],
  ['markup.italic', 'emphasis'],
  ['markup.underline.link', 'link'],
  ['markup.inline.raw', 'string'],
  ['meta.preprocessor', 'meta'],
  ['meta.decorator', 'meta'],
  ['meta.annotation', 'meta'],
  ['invalid', 'invalid'],
  ['punctuation', 'punctuation'],
]

const matches = (scope: string, prefix: string) =>
  scope === prefix || (scope.startsWith(prefix) && scope[prefix.length] === '.')

/** The kind a token with these scopes (outermost first, as Shiki gives them) is drawn as. */
export function tokenTypeOfScopes(scopes: readonly string[]): CodeTokenType | null {
  for (let i = scopes.length - 1; i > 0; i--) {
    const scope = scopes[i]!
    for (const [prefix, type] of SCOPES) if (matches(scope, prefix)) return type
  }
  return null
}

/** How long one line may take to read, in milliseconds, so a huge line doesn't hold up typing. */
const TIME_LIMIT = 50
/**
 * Lines up to this long are read to the end even past the time limit. The
 * first lines a grammar reads also build its patterns, which on a busy
 * machine can take longer than the limit; stopping there would cut a block
 * comment or string in two and color the lines after it wrongly.
 */
const ALWAYS_WHOLE = 2000

type ShikiGrammar = ReturnType<ShikiHighlighterLike['getLanguage']>
/** Reads a line within the time limit, and to its end when it is not too long. */
function readLine(grammar: ShikiGrammar, text: string, stack: ShikiStateStack | null) {
  const result = grammar.tokenizeLine(text, stack, TIME_LIMIT)
  return result.stoppedEarly && text.length <= ALWAYS_WHOLE
    ? grammar.tokenizeLine(text, stack, 0)
    : result
}

/**
 * Turns a language loaded into a Shiki highlighter into one the editor
 * reads. Shiki's grammar does the reading; its scopes are drawn with the
 * editor's own syntax colors, so the theme and dark mode apply as they do
 * to the built-in languages.
 *
 * ```ts
 * const highlighter = await createHighlighter({ langs: ['rust'], themes: [] })
 * const rust = shikiLanguage(highlighter, 'rust', { comment: { line: '//' } })
 * ```
 */
export function shikiLanguage(
  highlighter: ShikiHighlighterLike,
  language: string,
  options: ShikiLanguageOptions = {},
): CodeLanguage<ShikiState> {
  const grammar = highlighter.getLanguage(language)
  const typeOf = options.tokenType
    ? (scopes: readonly string[]) => {
        const own = options.tokenType!(scopes)
        return own === undefined ? tokenTypeOfScopes(scopes) : own
      }
    : tokenTypeOfScopes
  return defineCodeLanguage<ShikiState>({
    name: options.name ?? language,
    aliases: options.aliases,
    startState: () => ({ stack: null, line: null }),
    // the stack never changes once made: copies share it
    copyState: (state) => ({ stack: state.stack, line: state.line }),
    sameState: (a, b) => a.stack === b.stack || (!!a.stack && !!b.stack && a.stack.equals(b.stack)),
    token(stream, state) {
      let line = state.line
      if (!line || line.text !== stream.string || stream.pos < line.base) {
        // a new line: read it whole, and keep the state after it
        const text = stream.string.slice(stream.pos, stream.end)
        const result = readLine(grammar, text, state.stack)
        const ends: number[] = []
        const types: Array<CodeTokenType | null> = []
        for (const token of result.tokens) {
          ends.push(stream.pos + Math.min(token.endIndex, text.length))
          types.push(typeOf(token.scopes))
        }
        line = { text: stream.string, base: stream.pos, ends, types }
        state.stack = result.ruleStack
        state.line = line
      }
      for (let i = 0; i < line.ends.length; i++)
        if (line.ends[i]! > stream.pos) {
          stream.pos = Math.min(line.ends[i]!, stream.end)
          // the line is read: the next one is read afresh, even with the same text
          if (stream.pos >= stream.end) state.line = null
          return line.types[i]!
        }
      stream.skipToEnd()
      state.line = null
      return null
    },
    blankLine(state) {
      state.stack = readLine(grammar, '', state.stack).ruleStack
      state.line = null
    },
    comment: options.comment,
    brackets: options.brackets,
    autoClose: options.autoClose,
    indentAfter: options.indentAfter,
  })
}
