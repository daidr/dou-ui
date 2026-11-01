import { h, type VNodeChild } from 'vue'

/** Documentation as a language server sends it: Markdown or plain text, or a code block (`MarkedString`). */
export type Markup = string | { kind?: string; language?: string; value: string }

const INLINE = new RegExp(
  [
    /\\([\\`*_{}[\]()#+\-.!|~<>])/.source, // 1: an escaped mark
    /`([^`]+)`/.source, // 2: code
    /\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+"[^"]*")?\)/.source, // 3, 4: a link
    /<(https?:\/\/[^\s>]+)>/.source, // 5: an address in angle brackets
    /\*\*(.+?)\*\*|__(.+?)__/.source, // 6, 7: bold
    /\*([^*\s](?:[^*]*[^*\s])?)\*|(?<![\w])_([^_\s](?:[^_]*[^_\s])?)_(?![\w])/.source, // 8, 9: italic
  ].join('|'),
  'g',
)

const SAFE_LINK = /^https?:\/\//i

function link(href: string, children: VNodeChild[]): VNodeChild {
  // Only web addresses become links; anything else (`javascript:`, file paths) stays text.
  if (!SAFE_LINK.test(href)) return children
  return h(
    'a',
    { class: 'dou-code-lsp-markup__link', href, target: '_blank', rel: 'noopener noreferrer' },
    children,
  )
}

/** Inline Markdown: code, links (web addresses only), bold, italic and escapes; nothing is read as HTML. */
function inline(text: string): VNodeChild[] {
  const out: VNodeChild[] = []
  let at = 0
  for (const match of text.matchAll(INLINE)) {
    if (match.index > at) out.push(text.slice(at, match.index))
    const [, escaped, code, label, href, address, bold1, bold2, italic1, italic2] = match
    if (escaped !== undefined) out.push(escaped)
    else if (code !== undefined) out.push(h('code', { class: 'dou-code-lsp-markup__inline' }, code))
    else if (label !== undefined) out.push(link(href!, inline(label)))
    else if (address !== undefined) out.push(link(address, [address]))
    else if (bold1 !== undefined || bold2 !== undefined)
      out.push(h('strong', inline(bold1 ?? bold2!)))
    else out.push(h('em', inline(italic1 ?? italic2!)))
    at = match.index + match[0].length
  }
  if (at < text.length) out.push(text.slice(at))
  return out
}

type Block =
  | { type: 'code'; text: string }
  | { type: 'plain'; text: string }
  | { type: 'text'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'rule' }

/** Markdown text without code fences, as paragraphs, lists, rules and headings (shown in bold). */
function textBlocks(text: string, out: Block[]) {
  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  const end = () => {
    if (paragraph.length) out.push({ type: 'text', text: paragraph.join('\n') })
    paragraph = []
    if (list) out.push({ type: 'list', ...list })
    list = null
  }
  for (const line of text.split('\n')) {
    if (!line.trim()) {
      end()
      continue
    }
    if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      end()
      out.push({ type: 'rule' })
      continue
    }
    const heading = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line)
    if (heading) {
      end()
      out.push({ type: 'text', text: `**${heading[1]}**` })
      continue
    }
    const item = /^\s{0,3}(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(line)
    if (item) {
      const ordered = item[2] !== undefined
      if (paragraph.length || (list && list.ordered !== ordered)) end()
      list ??= { ordered, items: [] }
      list.items.push(item[3]!)
      continue
    }
    // A line under a list item goes on with it.
    if (list && /^\s+\S/.test(line)) list.items[list.items.length - 1] += ` ${line.trim()}`
    else {
      if (list) end()
      paragraph.push(line.trim())
    }
  }
  end()
}

/**
 * Documentation for the hover box, completion info and parameter hints:
 * Markdown's code blocks, lists, rules, headings, links, bold, italic and
 * code are drawn; plain text stays as it is. Nothing is read as HTML.
 * Returns plain text when there is nothing to draw.
 */
export function lspMarkup(markup: Markup | Markup[]): string | (() => VNodeChild) {
  const list = Array.isArray(markup) ? markup : [markup]
  const blocks: Block[] = []
  for (const part of list) {
    if (typeof part === 'object' && part.language !== undefined) {
      if (part.value.trim()) blocks.push({ type: 'code', text: part.value.replace(/\n$/, '') })
      continue
    }
    const value = typeof part === 'string' ? part : part.value
    if (typeof part === 'object' && part.kind === 'plaintext') {
      if (value.trim()) blocks.push({ type: 'plain', text: value.trim() })
      continue
    }
    value.split(/^```[^\n]*\n([\s\S]*?)^```[ \t]*$/m).forEach((piece, index) => {
      if (index % 2 === 0) textBlocks(piece, blocks)
      else if (piece.trim()) blocks.push({ type: 'code', text: piece.replace(/\n$/, '') })
    })
  }
  if (!blocks.length) return ''
  const only = blocks.length === 1 ? blocks[0]! : null
  if (only?.type === 'plain') return only.text
  // One paragraph with no marks in it reads the same as text.
  if (only?.type === 'text' && !/[\\`*_[<]/.test(only.text)) return only.text
  return () =>
    h(
      'div',
      { class: 'dou-code-lsp-markup' },
      blocks.map((block) => {
        if (block.type === 'code')
          return h('pre', { class: 'dou-code-lsp-markup__code' }, block.text)
        if (block.type === 'rule') return h('hr', { class: 'dou-code-lsp-markup__rule' })
        if (block.type === 'list')
          return h(
            block.ordered ? 'ol' : 'ul',
            { class: 'dou-code-lsp-markup__list' },
            block.items.map((item) => h('li', inline(item))),
          )
        return h(
          'p',
          { class: 'dou-code-lsp-markup__text' },
          block.type === 'plain' ? block.text : inline(block.text),
        )
      }),
    )
}
