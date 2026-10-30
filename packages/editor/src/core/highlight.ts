import type { Node as PMNode } from 'prosemirror-model'
import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state'
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view'

/**
 * Turns code into highlighted HTML, the same function `DouCodeBlock` takes:
 * `(code, lang) => codeToHtml(code, { lang, themes, defaultColor: false })`
 * with shiki works as is.
 */
export type CodeHighlighter = (code: string, lang: string) => string | Promise<string>

/** A highlighted stretch of a code block's text. */
interface Token {
  from: number
  to: number
  style: string
  className: string
}

interface HighlightState {
  decorations: DecorationSet
  /** The highlighter the editor falls back on, e.g. one set up in ConfigProvider. */
  fallback: CodeHighlighter | null
}

interface HighlightMeta {
  fallback?: CodeHighlighter | null
  /** Highlighting finished somewhere: rebuild the decorations. */
  refresh?: true
}

export const highlightKey = new PluginKey<HighlightState>('dou-editor-highlight')

/** Remembered results, by language and code: undo and redo find them again. */
const CACHE_SIZE = 200

/** Read the tokens from highlighted HTML: the text of each `<span>` with its style and class. */
export function readTokens(html: string, code: string): Token[] | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const root = doc.querySelector('code') ?? doc.body
  const tokens: Token[] = []
  let offset = 0
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    const span = node.parentElement
    const style = span?.getAttribute('style') ?? ''
    const className = span && !span.classList.contains('line') ? span.className : ''
    if (span && span !== root && (style || className) && text)
      tokens.push({ from: offset, to: offset + text.length, style, className })
    offset += text.length
  }
  // a highlighter may end with a newline; anything else that does not
  // match the code would put the colors in the wrong places
  const text = root.textContent ?? ''
  if (text !== code && text !== `${code}\n`) return null
  return tokens
}

const keyOf = (lang: string, code: string) => `${lang}\n${code}`
const isCode = (node: PMNode) => !!node.type.spec.code

function decorate(
  doc: PMNode,
  cache: Map<string, Token[]>,
  previous: DecorationSet,
): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    if (!isCode(node)) return false
    const start = pos + 1
    const tokens = cache.get(keyOf(node.attrs.language || 'text', node.textContent))
    if (tokens) {
      for (const token of tokens)
        decorations.push(
          Decoration.inline(start + token.from, start + token.to, {
            class: `dou-editor__token ${token.className}`.trim(),
            style: token.style,
          }),
        )
    } else {
      // keep the old colors (moved along with the edit) until the new ones arrive
      decorations.push(...previous.find(start, start + node.content.size))
    }
    return false
  })
  return DecorationSet.create(doc, decorations)
}

/**
 * Highlights code blocks with a highlighter that returns HTML. It runs
 * after each change (asynchronous highlighters are fine) and the colors
 * are laid over the text as decorations, so the document keeps plain text.
 */
export function highlightPlugin(highlight?: CodeHighlighter): Plugin<HighlightState> {
  const cache = new Map<string, Token[]>()
  const pending = new Set<string>()
  const highlighterOf = (state: EditorState) =>
    highlight ?? highlightKey.getState(state)?.fallback ?? null

  function remember(key: string, tokens: Token[]) {
    cache.delete(key)
    cache.set(key, tokens)
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!)
  }

  /** Start highlighting the code blocks that have no result yet. */
  function run(view: EditorView) {
    const highlighter = highlighterOf(view.state)
    if (!highlighter) return
    view.state.doc.descendants((node) => {
      if (!node.isTextblock) return true
      if (!isCode(node)) return false
      const lang = node.attrs.language || 'text'
      const code = node.textContent
      const key = keyOf(lang, code)
      if (cache.has(key) || pending.has(key)) return false
      pending.add(key)
      Promise.resolve()
        .then(() => highlighter(code, lang))
        .then(
          (html) => remember(key, readTokens(html, code) ?? []),
          // a language the highlighter does not know stays plain
          () => remember(key, []),
        )
        .then(() => {
          pending.delete(key)
          if (view.isDestroyed) return
          const tr = view.state.tr.setMeta(highlightKey, { refresh: true } satisfies HighlightMeta)
          view.dispatch(tr.setMeta('addToHistory', false))
        })
      return false
    })
  }

  return new Plugin<HighlightState>({
    key: highlightKey,
    state: {
      init: (_config, state) => ({
        decorations: decorate(state.doc, cache, DecorationSet.empty),
        fallback: null,
      }),
      apply(tr: Transaction, value, _old, state) {
        const meta = tr.getMeta(highlightKey) as HighlightMeta | undefined
        const fallback = meta && 'fallback' in meta ? (meta.fallback ?? null) : value.fallback
        if (!tr.docChanged && !meta?.refresh && fallback === value.fallback) return value
        const previous = value.decorations.map(tr.mapping, tr.doc)
        return { decorations: decorate(state.doc, cache, previous), fallback }
      },
    },
    view(view) {
      run(view)
      return {
        update(current, before) {
          if (
            current.state.doc !== before.doc ||
            highlighterOf(current.state) !== highlighterOf(before)
          )
            run(current)
        },
      }
    },
    props: {
      decorations: (state) => highlightKey.getState(state)?.decorations,
    },
  })
}

/** Set the highlighter used when the code block was not given one. */
export function setFallbackHighlighter(view: EditorView, highlight: CodeHighlighter | null) {
  if (!highlightKey.get(view.state)) return
  if (highlightKey.getState(view.state)?.fallback === highlight) return
  const tr = view.state.tr.setMeta(highlightKey, { fallback: highlight } satisfies HighlightMeta)
  view.dispatch(tr.setMeta('addToHistory', false))
}
