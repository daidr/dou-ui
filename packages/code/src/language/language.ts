import { markRaw } from 'vue'
import { CodeStream } from './stream'

/**
 * What a token is. The editor draws each kind with its
 * `--dou-color-syntax-*` color, so a theme recolors code without
 * highlighting it again.
 */
export type CodeTokenType =
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'function'
  | 'type'
  | 'variable'
  | 'property'
  | 'operator'
  | 'punctuation'
  | 'tag'
  | 'attribute'
  | 'meta'
  | 'invalid'
  | 'heading'
  | 'strong'
  | 'emphasis'
  | 'link'

/** Every token kind, in a fixed order; tokens are stored by their index here. */
export const tokenTypes: readonly CodeTokenType[] = [
  'keyword',
  'string',
  'number',
  'comment',
  'function',
  'type',
  'variable',
  'property',
  'operator',
  'punctuation',
  'tag',
  'attribute',
  'meta',
  'invalid',
  'heading',
  'strong',
  'emphasis',
  'link',
]
/** Lines longer than this are not read. */
const MAX_LINE = 10_000
const typeIndex = new Map(tokenTypes.map((type, i) => [type, i]))

export interface CodeLanguageSpec<S> {
  /** The name, also matched by `languageFor('…')` and code block `lang`. */
  name: string
  /** Other names, such as file extensions: `['js', 'mjs']`. */
  aliases?: string[]
  /** The state at the start of the text. Plain data: objects, arrays, strings, numbers. */
  startState?: () => S
  /**
   * Reads one token from the stream (at least one character) and returns
   * its kind, or `null` for plain text. May change `state`, which carries
   * over to the next token and the next line.
   */
  token: (stream: CodeStream, state: S) => CodeTokenType | null
  /** Called for an empty line, for states that end at a line's end. */
  blankLine?: (state: S) => void
  /** Copies a state. By default a deep copy of its plain objects and arrays. */
  copyState?: (state: S) => S
  /** Whether two states are the same. By default compares their plain data. */
  sameState?: (a: S, b: S) => boolean
  /** How the language writes comments, for toggling them. */
  comment?: { line?: string; block?: [open: string, close: string] }
  /** Bracket pairs, for matching and indenting. Default `'()[]{}'`. */
  brackets?: string
  /** Characters, as one string, that get their closing partner typed with them. Default the brackets' openers and `'"`. */
  autoClose?: string
  /** A line before the cursor that matches this gets one more indent on Enter, besides an open bracket. */
  indentAfter?: RegExp
  /** The language that is active in a state, for languages that hold others (a `<script>` in HTML). */
  languageAt?: (state: S) => CodeLanguage | null
  /**
   * The languages this one may hold, for languages with `languageAt`. A
   * worker sends states with the languages in them by name; these are the
   * ones the names are looked up in.
   */
  nested?: readonly CodeLanguage[]
}

/** A language: how to read its tokens, and a few facts for editing it. */
export interface CodeLanguage<S = any> {
  readonly name: string
  readonly aliases: readonly string[]
  startState(): S
  token(stream: CodeStream, state: S): CodeTokenType | null
  blankLine?(state: S): void
  copyState(state: S): S
  sameState(a: S, b: S): boolean
  readonly comment: { line?: string; block?: [string, string] }
  readonly brackets: string
  readonly autoClose: string
  readonly indentAfter?: RegExp
  languageAt(state: S): CodeLanguage | null
  readonly nested: readonly CodeLanguage[]
}

const isPlain = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)

/** Copies arrays and plain objects; everything else (languages among them) is shared. */
export function copyPlain<T>(value: T): T {
  if (Array.isArray(value)) return value.map(copyPlain) as T
  if (isPlain(value)) {
    const out: Record<string, unknown> = {}
    for (const key in value) out[key] = copyPlain(value[key])
    return out as T
  }
  return value
}

/** Compares arrays and plain objects by their content; everything else by identity. */
export function samePlain(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!samePlain(a[i], b[i])) return false
    return true
  }
  if (isPlain(a) && isPlain(b)) {
    const keys = Object.keys(a)
    if (keys.length !== Object.keys(b).length) return false
    for (const key of keys) if (!samePlain(a[key], b[key])) return false
    return true
  }
  return false
}

/**
 * Defines a language from a tokenizer that reads one line at a time.
 *
 * ```ts
 * const ini = defineCodeLanguage({
 *   name: 'ini',
 *   token(stream) {
 *     if (stream.sol() && stream.match(/^\s*[;#].*$/)) return 'comment'
 *     if (stream.sol() && stream.match(/^\s*\[[^\]]*\]/)) return 'keyword'
 *     if (stream.match(/^[\w.-]+(?=\s*=)/)) return 'property'
 *     stream.next()
 *     return null
 *   },
 * })
 * ```
 */
export function defineCodeLanguage<S = Record<string, never>>(
  spec: CodeLanguageSpec<S>,
): CodeLanguage<S> {
  const brackets = spec.brackets ?? '()[]{}'
  let openers = ''
  for (let i = 0; i < brackets.length; i += 2) openers += brackets[i]
  return markRaw({
    name: spec.name,
    aliases: spec.aliases ?? [],
    startState: spec.startState ?? (() => ({}) as S),
    token: spec.token,
    blankLine: spec.blankLine,
    copyState: spec.copyState ?? copyPlain,
    sameState: spec.sameState ?? samePlain,
    comment: spec.comment ?? {},
    brackets,
    autoClose: spec.autoClose ?? openers + '\'"',
    indentAfter: spec.indentAfter,
    languageAt: spec.languageAt ?? (() => null),
    nested: spec.nested ?? [],
  })
}

/** The language among `languages` named `name` or one of its aliases, ignoring case. */
export function languageFor(
  languages: readonly CodeLanguage[],
  name: string | undefined,
): CodeLanguage | null {
  if (!name) return null
  const key = name.trim().toLowerCase()
  return (
    languages.find(
      (language) => language.name.toLowerCase() === key || language.aliases.includes(key),
    ) ?? null
  )
}

/**
 * One line's tokens, as pairs of numbers: where each token ends and its
 * kind's index in `tokenTypes` (`-1` for plain text). Each token starts
 * where the one before ended.
 */
export type CodeLineTokens = readonly number[]

/** Reads one line from `state` (which it changes into the state after the line). */
export function tokenizeLine<S>(
  language: CodeLanguage<S>,
  text: string,
  state: S,
  tabSize = 2,
): CodeLineTokens {
  if (!text) {
    language.blankLine?.(state)
    return []
  }
  // Very long lines (minified code) are drawn plain; reading them would stall typing.
  if (text.length > MAX_LINE) return []
  const out: number[] = []
  const stream = new CodeStream(text, tabSize)
  let guard = 0
  while (!stream.eol()) {
    stream.start = stream.pos
    const type = language.token(stream, state)
    // A tokenizer that reads nothing would loop forever; take one character as plain text.
    if (stream.pos <= stream.start) {
      stream.pos = stream.start + 1
      push(out, stream.pos, -1)
    } else push(out, stream.pos, type ? (typeIndex.get(type) ?? -1) : -1)
    if (++guard > 100_000) break
  }
  return out
}

function push(out: number[], to: number, type: number) {
  // A token of the same kind as the one before joins it.
  if (out.length && out[out.length - 1] === type) out[out.length - 2] = to
  else out.push(to, type)
}

/** A line's tokens as `[text, kind]` pairs, kind `null` for plain text. */
export function lineParts(
  text: string,
  tokens: CodeLineTokens | null | undefined,
): Array<[text: string, type: CodeTokenType | null]> {
  if (!tokens?.length) return [[text, null]]
  const out: Array<[string, CodeTokenType | null]> = []
  let from = 0
  for (let i = 0; i < tokens.length; i += 2) {
    const to = tokens[i]!
    const type = tokens[i + 1]!
    if (to > from) out.push([text.slice(from, to), type < 0 ? null : tokenTypes[type]!])
    from = to
  }
  if (from < text.length) out.push([text.slice(from), null])
  return out
}
