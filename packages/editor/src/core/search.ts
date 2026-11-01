import type { Node as PMNode } from 'prosemirror-model'
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { originKey } from './editor'

/** What to look for in the editor's text. */
export interface EditorSearchQuery {
  /** The text, or a regular expression with `regexp`. */
  search: string
  /** What replacing puts in; with `regexp`, `$1` and `$<name>` refer to groups. */
  replace?: string
  /** Tells upper and lower case apart. */
  caseSensitive?: boolean
  /** Only matches that are whole words. */
  wholeWord?: boolean
  /** `search` is a regular expression (JavaScript syntax). */
  regexp?: boolean
}

/** A match, as document positions. */
export interface EditorMatch {
  from: number
  to: number
}

export interface EditorSearchState {
  query: EditorSearchQuery
  /** Whether matches are shown; a query is kept while the panel is closed. */
  active: boolean
  matches: EditorMatch[]
  /** More matches exist than were counted. */
  capped: boolean
  /** Why the regular expression can't be read, when it can't. */
  error?: string
  /** The match the selection is on. */
  current?: EditorMatch
  decorations: DecorationSet
}

export const searchKey = new PluginKey<EditorSearchState>('douSearch')

/** At most this many matches are counted and marked. */
const LIMIT = 10_000
const WORD = /[\p{L}\p{N}_]/u
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The query as one global regular expression, or the reason it can't be one. */
export function queryRegExp(query: EditorSearchQuery): RegExp | string {
  const flags = 'gu' + (query.caseSensitive ? '' : 'i')
  try {
    return new RegExp(query.regexp ? query.search : escapeRegExp(query.search), flags)
  } catch (error) {
    return (error as Error).message
  }
}

/**
 * The text of a textblock, one character per position: text as it is, and
 * `￼` for an inline node such as a mention or a line break, so an
 * offset in the text is an offset in the block.
 */
function blockText(node: PMNode) {
  let text = ''
  node.forEach((child) => {
    text += child.isText ? child.text! : '￼'.repeat(child.nodeSize)
  })
  return text
}

/**
 * Every match of the query in the document's text, in order, at most
 * `limit` of them. A match stays inside one block; blocks for which
 * `skip` says yes, such as ones that draw their own text, are left out.
 */
export function searchDoc(
  doc: PMNode,
  query: EditorSearchQuery,
  options: { limit?: number; skip?: (node: PMNode) => boolean } = {},
): { matches: EditorMatch[]; capped: boolean; error?: string } {
  const matches: EditorMatch[] = []
  if (!query.search) return { matches, capped: false }
  const re = queryRegExp(query)
  if (typeof re === 'string') return { matches, capped: false, error: re }
  const limit = options.limit ?? LIMIT
  let capped = false
  doc.descendants((node, pos) => {
    if (capped) return false
    if (options.skip?.(node)) return false
    if (!node.isTextblock) return true
    const text = blockText(node)
    const start = pos + 1
    re.lastIndex = 0
    let found: RegExpExecArray | null
    while ((found = re.exec(text))) {
      const from = found.index
      const to = from + found[0].length
      if (to === from) {
        re.lastIndex = from + 1
        continue
      }
      if (query.wholeWord && (WORD.test(text[from - 1] ?? '') || WORD.test(text[to] ?? '')))
        continue
      if (matches.length >= limit) {
        capped = true
        return false
      }
      matches.push({ from: start + from, to: start + to })
    }
    return false
  })
  return { matches, capped }
}

/** The text that replaces one match: `query.replace`, with groups filled in for a regular expression. */
export function replacementFor(doc: PMNode, match: EditorMatch, query: EditorSearchQuery): string {
  const replace = query.replace ?? ''
  if (!query.regexp) return replace
  const re = queryRegExp(query)
  if (typeof re === 'string') return replace
  const text = doc.textBetween(match.from, match.to, undefined, '￼')
  // match again on the matched text alone (lookarounds see only it), then expand `$1`, `$<name>`
  re.lastIndex = 0
  return text.replace(re, replace)
}

/** The index of the match the selection is on, or `-1`. */
export function currentMatch(state: EditorState): number {
  const s = searchKey.getState(state)
  return s?.current ? s.matches.indexOf(s.current) : -1
}

/** The index of the first match from `pos` on, wrapping round to the first. */
export function matchAfter(matches: readonly EditorMatch[], pos: number): number {
  if (!matches.length) return -1
  let lo = 0
  let hi = matches.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (matches[mid]!.from < pos) lo = mid + 1
    else hi = mid
  }
  return lo === matches.length ? 0 : lo
}

type SearchMeta = { query?: EditorSearchQuery; active?: boolean }

function decorate(doc: PMNode, matches: readonly EditorMatch[], current: EditorMatch | undefined) {
  return DecorationSet.create(
    doc,
    matches.map((m) =>
      Decoration.inline(m.from, m.to, {
        class: m === current ? 'dou-editor__match is-current' : 'dou-editor__match',
      }),
    ),
  )
}

/**
 * Keeps the matches of the query in step with the document and marks
 * them; the match the selection is on stands out.
 */
export function searchPlugin(options: { skip?: (node: PMNode) => boolean } = {}): Plugin {
  const find = (doc: PMNode, query: EditorSearchQuery) => searchDoc(doc, query, options)
  return new Plugin<EditorSearchState>({
    key: searchKey,
    state: {
      init: () => ({
        query: { search: '' },
        active: false,
        matches: [],
        capped: false,
        decorations: DecorationSet.empty,
      }),
      apply(tr, value, _old, state) {
        const meta = tr.getMeta(searchKey) as SearchMeta | undefined
        if (!meta && !tr.docChanged && !tr.selectionSet) return value
        const query = meta?.query ?? value.query
        const active = meta?.active ?? value.active
        if (!active || !query.search)
          return { query, active, matches: [], capped: false, decorations: DecorationSet.empty }
        const again = !!(meta?.query || meta?.active || tr.docChanged)
        const found = again
          ? find(state.doc, query)
          : { matches: value.matches, capped: value.capped, error: value.error }
        const { from, to } = state.selection
        const i = matchAfter(found.matches, from)
        const at = found.matches[i]
        const current = at && at.from === from && at.to === to ? at : undefined
        // only the selection moved, and not onto or off a match: the marks stay
        if (!again && current === value.current) return value
        return {
          query,
          active,
          ...found,
          current,
          decorations: decorate(state.doc, found.matches, current),
        }
      },
    },
    props: {
      decorations: (state) => searchKey.getState(state)?.decorations,
    },
  })
}

/** Sets the query, or shows or hides the matches, in a transaction. */
export function setSearch(tr: Transaction, meta: SearchMeta) {
  return tr.setMeta(searchKey, meta)
}

/**
 * Selects the first match from the cursor on, as a preview while the
 * search is typed; `null` when the selection is on a match already or
 * there is none.
 */
export function previewMatch(state: EditorState): Transaction | null {
  const s = searchKey.getState(state)
  if (!s?.active || !s.matches.length || s.current) return null
  return selectMatch(state, s.matches[matchAfter(s.matches, state.selection.from)]!)
}

/** Selects a match and scrolls it into view. */
export function selectMatch(state: EditorState, match: EditorMatch): Transaction {
  return state.tr
    .setSelection(TextSelection.create(state.doc, match.from, match.to))
    .scrollIntoView()
}

/**
 * Replaces the matches given, last first so the positions stay right, in
 * one transaction: one step to undo.
 */
export function replaceMatches(
  state: EditorState,
  matches: readonly EditorMatch[],
  query: EditorSearchQuery,
): Transaction {
  // the `transaction` event tells a replacement from typing
  const tr = state.tr.setMeta(originKey, 'replace')
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i]!
    const text = replacementFor(state.doc, m, query)
    if (text) tr.insertText(text, m.from, m.to)
    else tr.delete(m.from, m.to)
  }
  return tr
}
