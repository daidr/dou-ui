import {
  type CodeLanguage,
  type CodeTokenType,
  defineCodeLanguage,
  languageFor,
} from '../language/language'
import type { CodeStream } from '../language/stream'

export interface MarkdownState {
  /** The open code fence (`` ``` `` or `~~~`, with its length), or `''`. */
  fence: string
  /** The language of the fenced code, when it is one of `code`. */
  inner: { language: CodeLanguage; state: unknown } | null
}

export interface MarkdownOptions {
  /** Languages for fenced code, picked by the fence's info string (`` ```ts ``). */
  code?: readonly CodeLanguage[]
}

function inline(stream: CodeStream): CodeTokenType | null {
  if (stream.match(/^\\[\\`*_{}[\]()#+\-.!|<>~]/)) return null
  if (stream.match(/^(`+)[^`]*?\1/) || stream.match(/^`+/)) return 'string'
  if (stream.match(/^(\*\*|__)(?=\S)[^]*?\S\1/)) return 'strong'
  if (stream.match(/^([*_])(?=\S)[^*_]*?\S\1/)) return 'emphasis'
  if (stream.match(/^~~(?=\S)[^~]*?\S~~/)) return 'meta'
  if (stream.match(/^!?\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])?/)) return 'link'
  if (stream.match(/^<(?:https?:\/\/|mailto:)[^>]+>/)) return 'link'
  if (stream.match(/^<\/?[a-zA-Z][^>]*>/)) return 'tag'
  stream.next()
  stream.eatWhile(/[^\\`*_[!<~]/)
  return null
}

/** Makes Markdown; `code` lists the languages its fenced code is highlighted with. */
export function createMarkdown(options: MarkdownOptions = {}): CodeLanguage<MarkdownState> {
  const languages = options.code ?? []
  return defineCodeLanguage<MarkdownState>({
    name: 'markdown',
    aliases: ['md'],
    startState: () => ({ fence: '', inner: null }),
    copyState: (state) => ({
      fence: state.fence,
      inner: state.inner && {
        language: state.inner.language,
        state: state.inner.language.copyState(state.inner.state),
      },
    }),
    sameState: (a, b) =>
      a.fence === b.fence &&
      (a.inner === b.inner ||
        (!!a.inner &&
          !!b.inner &&
          a.inner.language === b.inner.language &&
          a.inner.language.sameState(a.inner.state, b.inner.state))),
    token(stream, state) {
      if (state.fence) {
        if (stream.pos === 0) {
          const close = stream.match(/^\s{0,3}(`{3,}|~{3,})\s*$/, false)
          if (close && close[1]!.startsWith(state.fence)) {
            stream.skipToEnd()
            state.fence = ''
            state.inner = null
            return 'meta'
          }
        }
        if (!state.inner) {
          stream.skipToEnd()
          return 'string'
        }
        return state.inner.language.token(stream, state.inner.state)
      }
      if (stream.pos === 0) {
        const fence = stream.match(/^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/)
        if (fence) {
          state.fence = fence[1]!
          const language = languageFor(languages, fence[2])
          state.inner = language && { language, state: language.startState() }
          stream.skipToEnd()
          return 'meta'
        }
        if (stream.match(/^\s{0,3}#{1,6}(?:\s|$)/)) {
          stream.skipToEnd()
          return 'heading'
        }
        if (stream.match(/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/)) return 'meta'
        if (stream.match(/^\s*>\s?/)) return 'meta'
        if (stream.match(/^\s*(?:[-*+]|\d+[.)])(?:\s+\[[ xX]\])?(?=\s)/)) return 'keyword'
      }
      return inline(stream)
    },
    comment: { block: ['<!--', '-->'] },
    closeBrackets: '([{`"',
    languageAt: (state) => state.inner?.language ?? null,
  })
}

export const markdown = createMarkdown()
