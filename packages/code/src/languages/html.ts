import { type CodeLanguage, type CodeTokenType, defineCodeLanguage } from '../language/language'
import type { CodeStream } from '../language/stream'
import { css, scss } from './css'
import { javascript, typescript } from './javascript'

/** A language running inside HTML: a `<script>`, a `<style>`, or a Vue expression. */
interface Inner {
  language: CodeLanguage
  state: unknown
  /** What ends it: `</script`, `}}` or the attribute's quote. */
  end: string
  /** A whole block (script or style), as opposed to an expression inside the markup. */
  block: boolean
}

export interface HtmlState {
  /** `text` between tags, `tag` among a tag's attributes. */
  in: 'text' | 'tag'
  /** The tag being read, lowercased. */
  tag: string
  /** The attribute just named, lowercased. */
  attr: string
  /** The `lang` or `type` the tag asked for. */
  lang: string
  /** Inside `<!-- … -->`. */
  comment: boolean
  /** An attribute value whose quote is still open at the line's end. */
  quote: string
  inner: Inner | null
}

interface HtmlOptions {
  /** Vue templates: `{{ … }}` and directive values are expressions. */
  vue?: boolean
}

const SCRIPT_TYPES = /^(?:|module|text\/javascript|application\/javascript|js|ts|typescript)$/

function scriptLanguage(lang: string) {
  return /^(?:ts|typescript|tsx)$/.test(lang) ? typescript : javascript
}

function styleLanguage(lang: string) {
  return /^(?:scss|sass|less|postcss)$/.test(lang) ? scss : css
}

/** Whether an attribute's value is an expression in a Vue template. */
const isDirective = (attr: string) => /^(?:v-[\w-]+|[:@#][^=]*)/.test(attr)

function enter(state: HtmlState, language: CodeLanguage, end: string, block: boolean) {
  state.inner = { language, state: language.startState(), end, block }
}

/** Reads one token of the inner language, stopping where it ends. */
function inner(stream: CodeStream, state: HtmlState): CodeTokenType | null | undefined {
  const at = state.inner!
  const rest = stream.string.slice(stream.pos)
  const index = at.end.startsWith('<') ? rest.toLowerCase().indexOf(at.end) : rest.indexOf(at.end)
  if (index === 0) {
    state.inner = null
    return undefined
  }
  const end = stream.end
  if (index > 0) stream.end = stream.pos + index
  const type = at.language.token(stream, at.state)
  stream.end = end
  if (stream.pos === stream.start) stream.next()
  return type
}

function tag(stream: CodeStream, state: HtmlState, options: HtmlOptions): CodeTokenType | null {
  if (stream.eatSpace()) return null
  if (stream.match('/>') || stream.eat('>')) {
    const name = state.tag
    state.in = 'text'
    if (stream.current() === '>') {
      if (name === 'script' && SCRIPT_TYPES.test(state.lang))
        enter(state, scriptLanguage(state.lang), '</script', true)
      else if (name === 'style') enter(state, styleLanguage(state.lang), '</style', true)
    }
    state.lang = ''
    return 'tag'
  }
  if (stream.eat('=')) return 'operator'
  const quote = stream.eat(/["']/)
  if (quote) {
    if (options.vue && isDirective(state.attr)) {
      enter(state, typescript, quote, false)
      return 'string'
    }
    return attrValue(stream, state, quote)
  }
  const name = stream.match(/^[^\s=>/"']+/)
  if (name) {
    state.attr = name[0].toLowerCase()
    return 'attribute'
  }
  stream.next()
  return null
}

/** Reads an attribute value up to its closing quote, which may be on a later line. */
function attrValue(stream: CodeStream, state: HtmlState, quote: string): CodeTokenType {
  const close = stream.string.indexOf(quote, stream.pos)
  const value = stream.string.slice(stream.pos, close < 0 ? undefined : close)
  if (state.attr === 'lang' || state.attr === 'type') state.lang += value.trim().toLowerCase()
  if (close < 0) {
    stream.skipToEnd()
    state.quote = quote
  } else {
    stream.pos = close + 1
    state.quote = ''
  }
  return 'string'
}

function text(stream: CodeStream, state: HtmlState, options: HtmlOptions): CodeTokenType | null {
  if (stream.match('<!--')) {
    state.comment = true
    return comment(stream, state)
  }
  if (stream.match(/^<![^>]*>?/)) return 'meta'
  const close = stream.match(/^<\/[\w:-]*\s*>?/)
  if (close) return 'tag'
  const open = stream.match(/^<([a-zA-Z][\w:.-]*)/)
  if (open) {
    state.in = 'tag'
    state.tag = open[1]!.toLowerCase()
    state.attr = ''
    state.lang = ''
    return 'tag'
  }
  if (options.vue && stream.match('{{')) {
    enter(state, typescript, '}}', false)
    return 'punctuation'
  }
  if (stream.match(/^&(?:#\d+|#x[\da-fA-F]+|[a-zA-Z]\w*);/)) return 'meta'
  stream.next()
  stream.eatWhile(options.vue ? /[^<&{]/ : /[^<&]/)
  return null
}

function comment(stream: CodeStream, state: HtmlState): CodeTokenType {
  if (stream.skipTo('-->')) {
    stream.pos += 3
    state.comment = false
  } else stream.skipToEnd()
  return 'comment'
}

/** Makes HTML, or a Vue single-file component. */
export function createHtml(
  name: string,
  aliases: string[],
  options: HtmlOptions = {},
): CodeLanguage<HtmlState> {
  return defineCodeLanguage<HtmlState>({
    name,
    aliases,
    startState: () => ({
      in: 'text',
      tag: '',
      attr: '',
      lang: '',
      comment: false,
      quote: '',
      inner: null,
    }),
    copyState: (state) => ({
      ...state,
      inner: state.inner && {
        ...state.inner,
        state: state.inner.language.copyState(state.inner.state),
      },
    }),
    sameState: (a, b) =>
      a.in === b.in &&
      a.tag === b.tag &&
      a.attr === b.attr &&
      a.lang === b.lang &&
      a.comment === b.comment &&
      a.quote === b.quote &&
      (a.inner === b.inner ||
        (!!a.inner &&
          !!b.inner &&
          a.inner.language === b.inner.language &&
          a.inner.end === b.inner.end &&
          a.inner.language.sameState(a.inner.state, b.inner.state))),
    token(stream, state) {
      if (state.inner) {
        const type = inner(stream, state)
        if (type !== undefined) return type
        // The inner language ended here: read its closing mark.
        if (stream.match('}}')) return 'punctuation'
        if (stream.eat(/["']/)) return 'string'
      }
      if (state.comment) return comment(stream, state)
      if (state.quote) return attrValue(stream, state, state.quote)
      return state.in === 'tag' ? tag(stream, state, options) : text(stream, state, options)
    },
    comment: { block: ['<!--', '-->'] },
    autoClose: '([{"\'',
    indentAfter:
      /<(?!\/|!|(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)\b)[\w:-]+(?:\s[^<>]*)?(?<!\/)>\s*$/i,
    languageAt: (state) => (state.inner?.block ? state.inner.language : null),
  })
}

export const html = createHtml('html', ['htm', 'xml', 'svg'])
export const vue = createHtml('vue', [], { vue: true })
