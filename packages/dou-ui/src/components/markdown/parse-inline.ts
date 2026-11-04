import type { MarkdownInline } from './markdown'

/** Link reference definitions, keyed by normalized label. */
export type MarkdownRefs = Map<string, { href: string; title?: string }>

type Text = { t: 'text'; v: string; at: number }
type Node = { t: 'node'; n: MarkdownInline }
type Delim = {
  t: 'delim'
  ch: '*' | '_' | '~'
  /** Length of the run as written. */
  n: number
  /** Characters not used by a match yet. */
  rem: number
  at: number
  open: boolean
  close: boolean
  alive: boolean
  hidden: boolean
  opens: number[]
  closes: number[]
}
type Bracket = { t: 'bracket'; image: boolean; at: number; active: boolean; pos: number }
type Tok = Text | Node | Delim | Bracket

const ESCAPABLE = /[!-/:-@[-`{-~]/
const WHITESPACE = /\s/
const PUNCT = /[\p{P}\p{S}]/u
// Han, kana, Hangul, and the full-width and CJK punctuation blocks
const CJK = /[ᄀ-ᇿ⺀-⿟　-〿぀-ヿ㄀-ㇿ㈀-鿿ꥠ-꥿가-퟿豈-﫿︰-﹏＀-￯]|[\ud840-\ud87f][\udc00-\udfff]/
const URL_STOP = /[\s<　-〿぀-ヿ㐀-鿿가-퟿豈-﫿︰-﹏＀-￯]/

// characters that may start something; everything else is copied as is
const SPECIAL = new Uint8Array(128)
for (const ch of '\\`*_~![]<&\nhHwW') SPECIAL[ch.charCodeAt(0)] = 1

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  middot: '·',
  times: '×',
  divide: '÷',
  deg: '°',
  plusmn: '±',
  larr: '←',
  rarr: '→',
  uarr: '↑',
  darr: '↓',
}

/** One character on either side of `index`, keeping surrogate pairs whole. */
function charBefore(text: string, index: number): string {
  if (index <= 0) return '\n'
  const low = text.charCodeAt(index - 1)
  if (low >= 0xdc00 && low <= 0xdfff && index >= 2) return text.slice(index - 2, index)
  return text[index - 1]!
}
function charAfter(text: string, index: number): string {
  if (index >= text.length) return '\n'
  const high = text.charCodeAt(index)
  if (high >= 0xd800 && high <= 0xdbff) return text.slice(index, index + 2)
  return text[index]!
}

export function isCjk(char: string | undefined): boolean {
  return !!char && CJK.test(char)
}

/** Decode `&name;` / `&#123;` at `index`, or return undefined. */
function entityAt(text: string, index: number): { value: string; end: number } | undefined {
  const match = /^&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z][a-zA-Z0-9]{1,31}));/.exec(
    text.slice(index, index + 40),
  )
  if (!match) return undefined
  let value: string | undefined
  if (match[3]) value = ENTITIES[match[3]]
  else {
    const code = Number.parseInt(match[1] ?? match[2]!, match[1] ? 10 : 16)
    value = code === 0 || code > 0x10ffff ? '�' : String.fromCodePoint(code)
  }
  return value === undefined ? undefined : { value, end: index + match[0].length }
}

/** Backslash escapes and entities, as in link destinations and titles. */
export function unescapeMarkdown(text: string): string {
  if (!/[\\&]/.test(text)) return text
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (ch === '\\' && ESCAPABLE.test(text[i + 1] ?? '')) {
      out += text[++i]
    } else if (ch === '&') {
      const entity = entityAt(text, i)
      if (entity) {
        out += entity.value
        i = entity.end - 1
      } else out += ch
    } else out += ch
  }
  return out
}

export function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** `(dest "title")` starting at the `(`; undefined when it does not parse. */
function linkTail(
  text: string,
  start: number,
): { href: string; title?: string; end: number } | undefined {
  let i = start + 1
  const skip = () => {
    while (i < text.length && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n')) i++
  }
  skip()
  let href = ''
  if (text[i] === '<') {
    const end = text.slice(i + 1).search(/[<>\n]/)
    if (end < 0 || text[i + 1 + end] !== '>') return undefined
    href = text.slice(i + 1, i + 1 + end)
    i += end + 2
  } else {
    let depth = 0
    const from = i
    while (i < text.length) {
      const ch = text[i]!
      if (ch === '\\' && ESCAPABLE.test(text[i + 1] ?? '')) i += 2
      else if (ch === '(') {
        depth++
        i++
      } else if (ch === ')') {
        if (depth === 0) break
        depth--
        i++
      } else if (ch <= ' ') break
      else i++
    }
    if (depth !== 0) return undefined
    href = text.slice(from, i)
  }
  const beforeTitle = i
  skip()
  let title: string | undefined
  const quote = text[i]
  if (i > beforeTitle && (quote === '"' || quote === "'" || quote === '(')) {
    const close = quote === '(' ? ')' : quote
    let j = i + 1
    while (j < text.length && text[j] !== close) j += text[j] === '\\' ? 2 : 1
    if (j >= text.length) return undefined
    title = unescapeMarkdown(text.slice(i + 1, j))
    i = j + 1
    skip()
  }
  if (text[i] !== ')') return undefined
  return { href: unescapeMarkdown(href), title, end: i + 1 }
}

/** The end of a bare `https://` or `www.` address starting at `index`, or -1. */
function autolinkEnd(text: string, index: number): number {
  const head = /^(?:https?:\/\/|www\.)/i.exec(text.slice(index, index + 8))
  if (!head) return -1
  let end = index
  while (end < text.length && !URL_STOP.test(text[end]!)) end++
  // trailing punctuation is not part of the address; a `)` only when unbalanced
  for (;;) {
    const last = text[end - 1]
    if (last && /[?!.,:*_~'"]/.test(last)) end--
    else if (last === ')') {
      const body = text.slice(index, end)
      const open = body.split('(').length - 1
      const close = body.split(')').length - 1
      if (close > open) end--
      else break
    } else break
  }
  if (end - index <= head[0].length) return -1
  return end
}

/**
 * Parse inline Markdown.
 *
 * `at` maps an index in `text` to its offset in the whole source. With
 * `partial`, `text` is the end of a stream: unfinished syntax at the end is
 * shown in its likely final form, and markers that may still turn into
 * something are hidden.
 */
export function parseInline(
  text: string,
  at: (index: number) => number,
  refs: MarkdownRefs,
  partial = false,
): MarkdownInline[] {
  if (partial) {
    // a marker at the very end may be the start of something
    text = text.replace(/(?:[*_~`\\<]|!?\[)+$/, '').replace(/[ \t]+$/, '')
  }
  const toks: Tok[] = []
  let buf = ''
  let bufAt = 0
  const flush = () => {
    if (buf) toks.push({ t: 'text', v: buf, at: bufAt })
    buf = ''
  }
  const add = (value: string, index: number) => {
    if (!buf) bufAt = at(index)
    buf += value
  }
  const push = (tok: Tok) => {
    flush()
    toks.push(tok)
  }
  const len = text.length
  let i = 0
  while (i < len) {
    const ch = text[i]!
    switch (ch) {
      case '\\': {
        const next = text[i + 1]
        if (next === '\n') {
          push({ t: 'node', n: { type: 'break' } })
          i += 2
          continue
        }
        if (next !== undefined && ESCAPABLE.test(next)) {
          add(next, i + 1)
          i += 2
          continue
        }
        add(ch, i)
        i++
        continue
      }
      case '`': {
        let n = 1
        while (text[i + n] === '`') n++
        let search = i + n
        let close = -1
        while (search < len) {
          const found = text.indexOf('`', search)
          if (found < 0) break
          let m = 1
          while (text[found + m] === '`') m++
          if (m === n) {
            close = found
            break
          }
          search = found + m
        }
        if (close < 0 && !partial) {
          add(text.slice(i, i + n), i)
          i += n
          continue
        }
        let value = text.slice(i + n, close < 0 ? len : close).replace(/\n/g, ' ')
        if (value.length > 2 && value[0] === ' ' && value[value.length - 1] === ' ' && value.trim())
          value = value.slice(1, -1)
        if (value) push({ t: 'node', n: { type: 'code', value, at: at(i + n) } })
        i = close < 0 ? len : close + n
        continue
      }
      case '*':
      case '_':
      case '~': {
        let n = 1
        while (text[i + n] === ch) n++
        if (ch === '~' && n !== 2) {
          add(text.slice(i, i + n), i)
          i += n
          continue
        }
        const before = charBefore(text, i)
        const after = charAfter(text, i + n)
        const wsBefore = WHITESPACE.test(before)
        const wsAfter = WHITESPACE.test(after)
        let left: boolean
        let right: boolean
        if (isCjk(before) || isCjk(after)) {
          // CJK has no spaces between words: `**注意：**这里` must close
          left = !wsAfter
          right = !wsBefore
        } else {
          const pBefore = PUNCT.test(before)
          const pAfter = PUNCT.test(after)
          left = !wsAfter && (!pAfter || wsBefore || pBefore)
          right = !wsBefore && (!pBefore || wsAfter || pAfter)
        }
        let open = left
        let close = right
        if (ch === '_') {
          open = left && (!right || PUNCT.test(before))
          close = right && (!left || PUNCT.test(after))
        }
        push({
          t: 'delim',
          ch,
          n,
          rem: n,
          at: at(i),
          open,
          close,
          alive: true,
          hidden: false,
          opens: [],
          closes: [],
        })
        i += n
        continue
      }
      case '!':
        if (text[i + 1] === '[') {
          push({ t: 'bracket', image: true, at: at(i), active: true, pos: i + 2 })
          i += 2
          continue
        }
        add(ch, i)
        i++
        continue
      case '[':
        push({ t: 'bracket', image: false, at: at(i), active: true, pos: i + 1 })
        i++
        continue
      case ']': {
        flush()
        let b = toks.length - 1
        while (b >= 0 && toks[b]!.t !== 'bracket') b--
        if (b < 0) {
          add(ch, i)
          i++
          continue
        }
        const opener = toks[b] as Bracket
        if (!opener.active) {
          toks[b] = { t: 'text', v: opener.image ? '![' : '[', at: opener.at }
          add(ch, i)
          i++
          continue
        }
        const label = text.slice(opener.pos, i)
        let target: { href: string; title?: string } | undefined
        let end = i + 1
        if (text[i + 1] === '(') {
          const tail = linkTail(text, i + 1)
          if (tail) {
            target = tail
            end = tail.end
          }
        }
        if (!target) {
          let ref = label
          if (text[i + 1] === '[') {
            const close = text.indexOf(']', i + 2)
            if (close >= 0) {
              const second = text.slice(i + 2, close)
              if (second.trim()) ref = second
              end = close + 1
            }
          }
          target = refs.get(normalizeLabel(ref))
          if (!target) end = i + 1
        }
        let pending = false
        if (!target && partial) {
          const rest = text.slice(i + 1)
          // `[text](` with the address on its way; a bare `[text]` stays text
          if (rest[0] === '(' && !rest.includes(')')) {
            pending = true
            end = len
          }
        }
        if (!target && !pending) {
          toks[b] = { t: 'text', v: opener.image ? '![' : '[', at: opener.at }
          add(ch, i)
          i++
          continue
        }
        const inner = toks.splice(b)
        inner.shift()
        if (opener.image) {
          // an image whose address is not here yet shows nothing
          if (target) {
            toks.push({
              t: 'node',
              n: {
                type: 'image',
                src: target.href,
                alt: plainText(resolve(inner, false)),
                ...(target.title ? { title: target.title } : {}),
              },
            })
          }
        } else {
          toks.push({
            t: 'node',
            n: {
              type: 'link',
              ...(target ? { href: target.href } : {}),
              ...(target?.title ? { title: target.title } : {}),
              children: resolve(inner, false),
            },
          })
          // no links inside links
          for (const tok of toks) if (tok.t === 'bracket' && !tok.image) tok.active = false
        }
        i = end
        continue
      }
      case '<': {
        const rest = text.slice(i, i + 300)
        const url = /^<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*)>/.exec(rest)
        const email =
          !url &&
          /^<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/.exec(
            rest,
          )
        const match = url || email
        if (match) {
          push({
            t: 'node',
            n: {
              type: 'link',
              href: email ? `mailto:${match[1]}` : match[1]!,
              children: [{ type: 'text', value: match[1]!, at: at(i + 1) }],
            },
          })
          i += match[0].length
          continue
        }
        if (partial && /^<[A-Za-z][A-Za-z0-9+.-]*:[^\s<>]*$/.test(text.slice(i))) {
          // an address in angle brackets still being written
          add(text.slice(i + 1), i + 1)
          i = len
          continue
        }
        add(ch, i)
        i++
        continue
      }
      case '&': {
        const entity = entityAt(text, i)
        if (entity) {
          add(entity.value, i)
          i = entity.end
          continue
        }
        add(ch, i)
        i++
        continue
      }
      case '\n': {
        const hard = / {2,}$/.test(buf)
        buf = buf.replace(/[ \t]+$/, '')
        const before = buf ? charBefore(buf, buf.length) : charBefore(text, i)
        if (hard) push({ t: 'node', n: { type: 'break' } })
        else {
          const cjk = isCjk(before) && isCjk(charAfter(text, i + 1))
          push({ t: 'node', n: cjk ? { type: 'softbreak', cjk } : { type: 'softbreak' } })
        }
        i++
        continue
      }
      case 'h':
      case 'H':
      case 'w':
      case 'W': {
        const prev = text[i - 1]
        if (prev === undefined || !/[A-Za-z0-9/.:@\-+&=%#]/.test(prev)) {
          const end = autolinkEnd(text, i)
          if (end > 0 && !insideLink(toks)) {
            const value = text.slice(i, end)
            push({
              t: 'node',
              n: {
                type: 'link',
                href: /^www\./i.test(value) ? `http://${value}` : value,
                children: [{ type: 'text', value, at: at(i) }],
              },
            })
            i = end
            continue
          }
        }
        add(ch, i)
        i++
        continue
      }
      default: {
        // copy plain text up to the next character that may mean something
        let j = i + 1
        while (j < len && !SPECIAL[text.charCodeAt(j)]) j++
        add(text.slice(i, j), i)
        i = j
      }
    }
  }
  flush()
  return resolve(toks, partial)
}

// bare addresses inside link text stay text
function insideLink(toks: Tok[]): boolean {
  return toks.some((tok) => tok.t === 'bracket' && tok.active && !tok.image)
}

function plainText(nodes: MarkdownInline[]): string {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'text' || node.type === 'code') out += node.value
    else if (node.type === 'image') out += node.alt
    else if (node.type === 'softbreak' || node.type === 'break') out += ' '
    else out += plainText(node.children)
  }
  return out
}

type Match = 'strong' | 'em' | 'del'

/** Match emphasis delimiters and build the inline tree. */
function resolve(input: Tok[], partial: boolean): MarkdownInline[] {
  let toks = input
  // brackets that never closed
  for (let index = 0; index < toks.length; index++) {
    const tok = toks[index]!
    if (tok.t !== 'bracket') continue
    if (partial) {
      const rest = toks.slice(index + 1)
      const digits = rest.every((t) => t.t === 'text' && /^\d*$/.test(t.v))
      if (tok.image || digits) {
        // an image, or a citation like `[1` still being written
        toks = toks.slice(0, index)
        break
      }
      toks = [...toks.slice(0, index), ...rest]
      index--
    } else toks[index] = { t: 'text', v: tok.image ? '![' : '[', at: tok.at }
  }

  const matches: Match[] = []
  const delims: Delim[] = []
  for (const tok of toks) if (tok.t === 'delim') delims.push(tok)
  const bottoms = new Map<string, number>()
  for (let ci = 0; ci < delims.length; ci++) {
    const closer = delims[ci]!
    if (!closer.close) continue
    const key = `${closer.ch}${closer.open ? 1 : 0}${closer.n % 3}`
    while (closer.rem > 0) {
      const bottom = bottoms.get(key) ?? -1
      let found = -1
      for (let oi = ci - 1; oi > bottom; oi--) {
        const opener = delims[oi]!
        if (!opener.alive || !opener.open || opener.rem === 0 || opener.ch !== closer.ch) continue
        if (
          closer.ch !== '~' &&
          (opener.close || closer.open) &&
          (opener.n + closer.n) % 3 === 0 &&
          !(opener.n % 3 === 0 && closer.n % 3 === 0)
        )
          continue
        found = oi
        break
      }
      if (found < 0) {
        bottoms.set(key, ci - 1)
        break
      }
      const opener = delims[found]!
      const use = closer.ch === '~' ? 2 : opener.rem >= 2 && closer.rem >= 2 ? 2 : 1
      opener.rem -= use
      closer.rem -= use
      const id = matches.push(closer.ch === '~' ? 'del' : use === 2 ? 'strong' : 'em') - 1
      opener.opens.push(id)
      closer.closes.push(id)
      for (let k = found + 1; k < ci; k++) delims[k]!.alive = false
    }
  }

  // At the end of a stream an unclosed `**` shows as bold already; a bare one hides.
  const ends: number[] = []
  if (partial) {
    for (let di = delims.length - 1; di >= 0; di--) {
      const opener = delims[di]!
      if (!opener.alive || !opener.open || opener.rem === 0) continue
      const index = toks.indexOf(opener)
      const content = toks
        .slice(index + 1)
        .some((t) => t.t === 'node' || t.t === 'delim' || (t.t === 'text' && t.v.trim()))
      if (!content) {
        opener.hidden = true
        continue
      }
      while (opener.rem >= (opener.ch === '~' ? 2 : 1)) {
        const use = opener.ch === '~' ? 2 : opener.rem >= 2 ? 2 : 1
        opener.rem -= use
        const id = matches.push(opener.ch === '~' ? 'del' : use === 2 ? 'strong' : 'em') - 1
        opener.opens.push(id)
        ends.push(id)
      }
    }
  }

  const root: MarkdownInline[] = []
  const stack: MarkdownInline[][] = []
  let current = root
  const addText = (value: string, offset: number) => {
    if (!value) return
    const last = current[current.length - 1]
    if (last?.type === 'text') last.value += value
    else current.push({ type: 'text', value, at: offset })
  }
  const close = () => {
    if (stack.length) current = stack.pop()!
  }
  for (const tok of toks) {
    if (tok.t === 'text') addText(tok.v, tok.at)
    else if (tok.t === 'node') current.push(tok.n)
    else if (tok.t === 'delim') {
      for (let k = 0; k < tok.closes.length; k++) close()
      if (!tok.hidden) addText(tok.ch.repeat(tok.rem), tok.at)
      for (let k = tok.opens.length - 1; k >= 0; k--) {
        const node = { type: matches[tok.opens[k]!]!, children: [] as MarkdownInline[] }
        current.push(node)
        stack.push(current)
        current = node.children
      }
    }
  }
  for (let k = 0; k < ends.length; k++) close()
  return root
}
