/*
 * A small XML reader, enough for the parts of an .xlsx file. It doesn't
 * need `DOMParser`, which Workers don't have, and it goes through a big
 * sheet a piece at a time.
 */

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }

/** Text with its entities, such as `&amp;` and `&#20013;`, turned back into characters. */
export function unescape(text: string) {
  if (!text.includes('&')) return text
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, name: string) => {
    if (name[0] !== '#') return ENTITIES[name] ?? match
    const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : +name.slice(1)
    return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : match
  })
}

/** An element's attributes by name, without their prefixes: `r:id` is `id`. */
export function attrsOf(raw: string) {
  const out: Record<string, string> = {}
  const length = raw.length
  let at = 0
  while (at < length) {
    if (raw.charCodeAt(at) <= 32) {
      at++
      continue
    }
    const eq = raw.indexOf('=', at)
    if (eq === -1) break
    const name = raw.slice(at, eq).trim()
    let start = eq + 1
    while (start < length && raw.charCodeAt(start) <= 32) start++
    const quote = raw[start]
    if (quote !== '"' && quote !== "'") break
    const end = raw.indexOf(quote, start + 1)
    if (end === -1) break
    // namespace declarations aren't attributes of the content
    if (name !== 'xmlns' && !name.startsWith('xmlns:')) {
      const colon = name.indexOf(':')
      out[colon === -1 ? name : name.slice(colon + 1)] = unescape(raw.slice(start + 1, end))
    }
    at = end + 1
  }
  return out
}

/** A yes-or-no attribute, which files write as `1` or `true`. */
export const isOn = (value: string | undefined) => value === '1' || value === 'true'
/** Whether a true-or-false attribute is off; one left out is neither. */
export const isOff = (value: string | undefined) => value === '0' || value === 'false'

/** An attribute that is on unless it says `0` or `false`. */
export const isNotOff = (value: string | undefined) => value !== '0' && value !== 'false'

/** What a reader is told as it goes through the text. */
export interface XmlHandler {
  /** An element starts; `empty` when it ends there too, as `<a/>`. Names are without prefixes. */
  open(name: string, attrs: string, empty: boolean): void
  close?(name: string): void
  /** Text between elements, its entities already turned back. */
  text?(text: string): void
}

/**
 * Goes through XML text, telling `handler` what it meets. `step` reads up
 * to `budget` tags and says whether there is more, so a big part can be
 * read in pieces with pauses between.
 */
export class XmlReader {
  private at = 0

  constructor(
    private readonly xml: string,
    private readonly handler: XmlHandler,
  ) {}

  /** Reads on; `false` once the text is done. */
  step(budget = Infinity) {
    const { xml, handler } = this
    const length = xml.length
    let at = this.at
    for (let n = 0; n < budget; n++) {
      const open = xml.indexOf('<', at)
      if (open === -1) {
        if (handler.text && at < length) handler.text(unescape(xml.slice(at)))
        this.at = length
        return false
      }
      if (handler.text && open > at) handler.text(unescape(xml.slice(at, open)))
      const next = xml.charCodeAt(open + 1)
      // a comment, a CDATA section or a doctype
      if (next === 33) {
        if (xml.startsWith('<![CDATA[', open)) {
          const end = xml.indexOf(']]>', open)
          handler.text?.(xml.slice(open + 9, end === -1 ? length : end))
          at = end === -1 ? length : end + 3
        } else if (xml.startsWith('<!--', open)) {
          const end = xml.indexOf('-->', open)
          at = end === -1 ? length : end + 3
        } else {
          const end = xml.indexOf('>', open)
          at = end === -1 ? length : end + 1
        }
        continue
      }
      // a declaration, such as `<?xml …?>`
      if (next === 63) {
        const end = xml.indexOf('?>', open)
        at = end === -1 ? length : end + 2
        continue
      }
      // the tag's end, past any `>` in a quoted attribute
      let end = open + 1
      let quote = 0
      for (; end < length; end++) {
        const char = xml.charCodeAt(end)
        if (quote) {
          if (char === quote) quote = 0
        } else if (char === 34 || char === 39) quote = char
        else if (char === 62) break
      }
      const closing = next === 47
      const nameStart = closing ? open + 2 : open + 1
      let nameEnd = nameStart
      while (nameEnd < end) {
        const char = xml.charCodeAt(nameEnd)
        if (char <= 32 || char === 47) break
        nameEnd++
      }
      let name = xml.slice(nameStart, nameEnd)
      const colon = name.indexOf(':')
      if (colon !== -1) name = name.slice(colon + 1)
      if (closing) handler.close?.(name)
      else {
        const empty = xml.charCodeAt(end - 1) === 47
        handler.open(name, xml.slice(nameEnd, empty ? end - 1 : end), empty)
        if (empty) handler.close?.(name)
      }
      at = end + 1
    }
    this.at = at
    return true
  }
}

/** An element of a small part, read whole. */
export interface XmlNode {
  name: string
  attrs: Record<string, string>
  children: XmlNode[]
  /** The text inside it, its children's included. */
  text: string
}

/** Reads a small part, such as the workbook or the styles, as a tree. */
export function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: '', attrs: {}, children: [], text: '' }
  const stack = [root]
  new XmlReader(xml, {
    open(name, raw) {
      const node: XmlNode = { name, attrs: attrsOf(raw), children: [], text: '' }
      stack.at(-1)!.children.push(node)
      stack.push(node)
    },
    close() {
      const node = stack.pop()!
      if (stack.length) stack.at(-1)!.text += node.text
      else stack.push(node)
    },
    text(text) {
      stack.at(-1)!.text += text
    },
  }).step()
  return root.children[0] ?? root
}

/** The children of a node with this name. */
export const childrenOf = (node: XmlNode | undefined, name: string) =>
  node ? node.children.filter((child) => child.name === name) : []

/** The first child of a node with this name. */
export const childOf = (node: XmlNode | undefined, name: string) =>
  node?.children.find((child) => child.name === name)
