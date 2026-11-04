import type { MarkdownAlign } from './markdown'
import { normalizeLabel, unescapeMarkdown, type MarkdownRefs } from './parse-inline'

/*
 * Block structure, line by line, after the CommonMark algorithm: each line
 * first continues the open containers it can (quote, list item, ...), then
 * may open new ones, and what is left goes into a leaf.
 *
 * What makes it fit a stream: when a top-level block closes while a whole
 * line (one that ends in `\n`) is being read, nothing is open but the
 * document, so parsing again from that line gives exactly what parsing
 * from the start would. The parser records that point; the next parse of
 * a longer source starts there.
 */

export type BlockKind =
  | 'document'
  | 'blockquote'
  | 'container'
  | 'list'
  | 'item'
  | 'paragraph'
  | 'heading'
  | 'code'
  | 'hr'
  | 'table'

/** A source line of a leaf: its text and where that text starts in the source. */
export interface SourceLine {
  text: string
  at: number
  /** Where the whole line starts. */
  line: number
}

export interface BNode {
  kind: BlockKind
  parent: BNode | null
  children: BNode[]
  open: boolean
  start: number
  end: number
  startLine: number
  endLine: number
  lines: SourceLine[]
  level: number
  fence: { ch: string; len: number; indent: number } | null
  info: string
  closed: boolean
  ordered: boolean
  marker: string
  startNumber: number
  offset: number
  padding: number
  align: MarkdownAlign[]
}

interface Line {
  text: string
  start: number
  complete: boolean
  number: number
}

const MARKER_ONLY = /^(?:(?:[-*+_=#`~>][ \t]*)+|\d{1,9}[.)]?[ \t]*)$/
const MAYBE_SPECIAL = /^[#`~*+_=<>0-9|:-]/
const ATX = /^#{1,6}(?:[ \t]|$)/
const FENCE = /^(?:`{3,}(?!.*`)|~{3,})/
const CLOSE_FENCE = /^(?:`{3,}|~{3,})(?=[ \t]*$)/
const SETEXT = /^(?:=+|-+)[ \t]*$/
const HR = /^(?:(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|(?:-[ \t]*){3,})$/
const TABLE_DELIM = /^\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/
const TABLE_DELIM_PARTIAL = /^[|:\- \t]*-[|:\- \t]*$/
const TABLE_BREAK = /^(?:>|#{1,6}(?:[ \t]|$)|`{3,}|~{3,}|:{3,}|[*+-][ \t]|\d{1,9}[.)][ \t])/
/** `:::name title` opens a custom block; more colons let one hold another. */
const CONTAINER = /^(:{3,})[ \t]*([A-Za-z][\w-]*)(?:[ \t]+(.*?))?[ \t]*$/
const CLOSE_CONTAINER = /^:{3,}(?=[ \t]*$)/
/** A container fence still being written: colons, maybe the start of a name. */
const CONTAINER_PARTIAL = /^:+(?:[ \t]*[A-Za-z][\w-]*)?[ \t]*$/
const DEF =
  /^\[((?:[^\]\\\n]|\\.){1,999})\]:[ \t]*(<[^>\n]*>|\S+)(?:[ \t]+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\((?:[^)\\]|\\.)*\)))?[ \t]*$/

const isSpace = (ch: string | undefined) => ch === ' ' || ch === '\t'

function node(kind: BlockKind, start: number, line: number): BNode {
  return {
    kind,
    parent: null,
    children: [],
    open: true,
    start,
    end: start,
    startLine: line,
    endLine: line,
    lines: [],
    level: 0,
    fence: null,
    info: '',
    closed: false,
    ordered: false,
    marker: '',
    startNumber: 1,
    offset: 0,
    padding: 0,
    align: [],
  }
}

const canContain = (parent: BlockKind, child: BlockKind) =>
  parent === 'list'
    ? child === 'item'
    : (parent === 'document' ||
        parent === 'blockquote' ||
        parent === 'container' ||
        parent === 'item') &&
      child !== 'item'

const acceptsLines = (kind: BlockKind) =>
  kind === 'paragraph' || kind === 'code' || kind === 'table'

/** Cells of a table row, with where each starts in `text`. */
export function splitRow(text: string): { text: string; index: number }[] {
  const cells: { text: string; index: number }[] = []
  let i = 0
  while (isSpace(text[i])) i++
  if (text[i] === '|') i++
  let from = i
  for (; i <= text.length; i++) {
    const ch = text[i]
    if (ch === '\\') {
      i++
      continue
    }
    if (ch === '|' || i === text.length) {
      const raw = text.slice(from, i)
      const lead = raw.length - raw.trimStart().length
      cells.push({ text: raw.trim().replace(/\\\|/g, '|'), index: from + lead })
      from = i + 1
    }
  }
  // a closing pipe leaves an empty cell behind it
  if (cells.length > 1 && !cells[cells.length - 1]!.text && /\|[ \t]*$/.test(text)) cells.pop()
  return cells
}

function alignOf(cell: string): MarkdownAlign {
  const left = cell.startsWith(':')
  const right = cell.endsWith(':') && cell.length > 1
  return left && right ? 'center' : left ? 'left' : right ? 'right' : ''
}

export interface BlockParseResult {
  /** The top-level blocks. */
  blocks: BNode[]
  /** How many leading blocks can no longer change. */
  stable: number
  /** Where to start the next parse, when `stable` blocks are kept. */
  resume: number
  /** Link reference definitions found. */
  refs: MarkdownRefs
  /** Labels defined inside the stable blocks. */
  stableLabels: string[]
  /** The leaf still being written, which shows unfinished syntax in its likely final form. */
  tip: BNode | null
  /** Whether the last line ends in a newline. */
  complete: boolean
}

class BlockParser {
  doc = node('document', 0, 0)
  tip = this.doc
  oldtip = this.doc
  lastMatched = this.doc
  allClosed = true
  line: Line = { text: '', start: 0, complete: true, number: 0 }
  pos = 0
  col = 0
  nextNonspace = 0
  nextNonspaceCol = 0
  indent = 0
  indented = false
  blank = false
  stable = 0
  resume: number
  closeResume: number | null = null
  refs: MarkdownRefs = new Map()
  stableLabels: string[] = []
  pendingLabels: string[] = []
  ending = false
  /** A leaf opened by this line whose marker line holds no content. */
  started: BNode | null = null

  constructor(
    readonly partial: boolean,
    from: number,
  ) {
    this.resume = from
  }

  findNonspace() {
    const text = this.line.text
    let i = this.pos
    let col = this.col
    while (i < text.length) {
      const ch = text[i]
      if (ch === ' ') col++
      else if (ch === '\t') col += 4 - (col % 4)
      else break
      i++
    }
    this.blank = i >= text.length
    this.nextNonspace = i
    this.nextNonspaceCol = col
    this.indent = col - this.col
    this.indented = this.indent >= 4
  }

  advanceNextNonspace() {
    this.pos = this.nextNonspace
    this.col = this.nextNonspaceCol
  }

  /** Move by `count` characters, or columns when `columns` (a tab is taken whole). */
  advance(count: number, columns = false) {
    const text = this.line.text
    while (count > 0 && this.pos < text.length) {
      const ch = text[this.pos]
      if (ch === '\t') {
        const width = 4 - (this.col % 4)
        this.col += width
        count -= columns ? width : 1
      } else {
        this.col++
        count--
      }
      this.pos++
    }
  }

  get rest() {
    return this.line.text.slice(this.nextNonspace)
  }

  touch(block: BNode) {
    const end = this.line.start + this.line.text.length
    for (let b: BNode | null = block; b && b !== this.doc; b = b.parent) {
      b.end = end
      b.endLine = this.line.number
    }
  }

  addChild(kind: BlockKind): BNode {
    this.closeUnmatched()
    while (!canContain(this.tip.kind, kind)) this.finalize(this.tip)
    const child = node(kind, this.line.start, this.line.number)
    child.end = this.line.start + this.line.text.length
    child.parent = this.tip
    this.tip.children.push(child)
    this.tip = child
    this.touch(child)
    return child
  }

  closeUnmatched() {
    if (this.allClosed) return
    while (this.oldtip !== this.lastMatched) {
      const parent = this.oldtip.parent!
      this.finalize(this.oldtip)
      this.oldtip = parent
    }
    this.allClosed = true
  }

  finalize(block: BNode) {
    const parent = block.parent!
    block.open = false
    if (block.kind === 'paragraph') {
      const labels = this.extractDefs(block)
      this.pendingLabels.push(...labels)
      if (!block.lines.length) parent.children.splice(parent.children.indexOf(block), 1)
    } else if (block.kind === 'code' && !block.fence) {
      while (block.lines.length && !block.lines[block.lines.length - 1]!.text.trim()) {
        block.lines.pop()
        block.endLine--
      }
      const last = block.lines[block.lines.length - 1]
      if (last) block.end = last.at + last.text.length
    }
    this.tip = parent
    if (parent === this.doc) {
      if (!this.ending && this.line.complete) {
        this.stable = this.doc.children.length
        this.resume = this.closeResume ?? this.line.start
        this.stableLabels.push(...this.pendingLabels)
        this.pendingLabels = []
      }
    }
  }

  /** Take link reference definitions off the start of a paragraph. */
  extractDefs(block: BNode): string[] {
    const labels: string[] = []
    while (block.lines.length) {
      const match = DEF.exec(block.lines[0]!.text)
      if (!match) break
      const label = normalizeLabel(match[1]!)
      if (!label) break
      let href = match[2]!
      if (href.startsWith('<')) href = href.slice(1, -1)
      const title = match[3] ? unescapeMarkdown(match[3].slice(1, -1)) : undefined
      // a definition still being written is hidden, but its address is not known yet
      const writing =
        this.partial && !this.line.complete && block.lines[0]!.line === this.line.start
      if (!writing && !this.refs.has(label))
        this.refs.set(label, { href: unescapeMarkdown(href), ...(title ? { title } : {}) })
      labels.push(label)
      block.lines.shift()
    }
    if (block.lines.length) block.start = block.lines[0]!.line
    return labels
  }

  addLine() {
    const tip = this.tip
    const text = this.line.text
    if (tip.kind === 'code') {
      tip.lines.push({
        text: text.slice(this.pos),
        at: this.line.start + this.pos,
        line: this.line.start,
      })
    } else {
      let i = this.pos
      while (isSpace(text[i])) i++
      tip.lines.push({ text: text.slice(i), at: this.line.start + i, line: this.line.start })
    }
    this.touch(tip)
  }

  /** 0: matched, 1: not matched, 2: the line was used up. */
  continueBlock(block: BNode): 0 | 1 | 2 {
    const text = this.line.text
    switch (block.kind) {
      case 'blockquote':
        if (!this.indented && text[this.nextNonspace] === '>') {
          this.advanceNextNonspace()
          this.advance(1)
          if (isSpace(text[this.pos])) this.advance(1, true)
          return 0
        }
        return 1
      case 'item':
        if (this.blank) {
          if (!block.children.length) return 1
          this.advanceNextNonspace()
          return 0
        }
        if (this.indent >= block.offset + block.padding) {
          this.advance(block.offset + block.padding, true)
          return 0
        }
        return 1
      case 'list':
        return 0
      case 'container': {
        const match = this.indent <= 3 ? CLOSE_CONTAINER.exec(this.rest) : null
        if (!match) return 0
        // the innermost open container the fence is long enough for
        let target = block
        for (let b = lastOpen(block); b; b = lastOpen(b))
          if (b.kind === 'container' && b.fence!.len <= match[0].length) target = b
        target.closed = true
        this.touch(target)
        if (target.parent === this.doc) this.closeResume = this.line.start + text.length + 1
        while (this.tip !== target) this.finalize(this.tip)
        this.finalize(target)
        this.closeResume = null
        return 2
      }
      case 'code': {
        const fence = block.fence
        if (fence) {
          const match = this.indent <= 3 ? CLOSE_FENCE.exec(this.rest) : null
          if (match && match[0][0] === fence.ch && match[0].length >= fence.len) {
            block.closed = true
            this.touch(block)
            this.closeResume = this.line.start + text.length + 1
            this.finalize(block)
            this.closeResume = null
            return 2
          }
          let skip = fence.indent
          while (skip > 0 && isSpace(text[this.pos])) {
            this.advance(1, true)
            skip--
          }
          return 0
        }
        if (this.indent >= 4) {
          this.advance(4, true)
          return 0
        }
        if (this.blank) {
          this.advanceNextNonspace()
          return 0
        }
        return 1
      }
      case 'paragraph':
        return this.blank ? 1 : 0
      case 'table':
        if (this.blank || this.indented) return 1
        return TABLE_BREAK.test(this.rest) || HR.test(this.rest) ? 1 : 0
      default:
        return 1
    }
  }

  startTable(paragraph: BNode, align: MarkdownAlign[]) {
    const header = paragraph.lines.pop()!
    this.closeResume = header.line
    if (paragraph.lines.length) {
      const last = paragraph.lines[paragraph.lines.length - 1]!
      paragraph.end = last.at + last.text.length
      paragraph.endLine = this.line.number - 2
      this.finalize(paragraph)
    } else {
      const parent = paragraph.parent!
      parent.children.splice(parent.children.indexOf(paragraph), 1)
      this.tip = parent
    }
    this.closeResume = null
    this.oldtip = this.tip
    this.lastMatched = this.tip
    const table = this.addChild('table')
    table.start = header.line
    table.startLine = this.line.number - 1
    table.lines.push(header)
    table.align = align
    this.pos = this.line.text.length
    this.started = table
  }

  tryStart(container: BNode): 0 | 1 | 2 {
    const text = this.line.text
    const rest = this.rest
    if (!this.indented) {
      if (rest[0] === '>') {
        this.advanceNextNonspace()
        this.advance(1)
        if (isSpace(text[this.pos])) this.advance(1, true)
        this.addChild('blockquote')
        return 1
      }
      if (ATX.test(rest)) {
        this.advanceNextNonspace()
        const heading = this.addChild('heading')
        const hashes = /^#+/.exec(rest)![0].length
        heading.level = hashes
        const content = rest
          .slice(hashes)
          .replace(/^[ \t]+/, '')
          .replace(/(?:^|[ \t]+)#+[ \t]*$/, '')
          .replace(/[ \t]+$/, '')
        const lead = rest.slice(hashes).length - rest.slice(hashes).replace(/^[ \t]+/, '').length
        heading.lines.push({
          text: content,
          at: this.line.start + this.nextNonspace + hashes + lead,
          line: this.line.start,
        })
        this.pos = text.length
        this.started = heading
        return 2
      }
      const directive = CONTAINER.exec(rest)
      if (directive) {
        const indent = this.indent
        this.advanceNextNonspace()
        const box = this.addChild('container')
        box.fence = { ch: ':', len: directive[1]!.length, indent }
        box.marker = directive[2]!
        box.info = directive[3] ?? ''
        this.pos = text.length
        this.started = box
        return 2
      }
      const fence = FENCE.exec(rest)
      if (fence) {
        const indent = this.indent
        this.advanceNextNonspace()
        const code = this.addChild('code')
        code.fence = { ch: fence[0][0]!, len: fence[0].length, indent }
        code.info = unescapeMarkdown(rest.slice(fence[0].length).trim())
        this.pos = text.length
        this.started = code
        return 2
      }
      if (container.kind === 'paragraph' && container === this.tip && rest.includes('|')) {
        const delims = TABLE_DELIM.test(rest) ? splitRow(rest) : null
        const header = container.lines[container.lines.length - 1]!
        if (delims && delims.length === splitRow(header.text).length) {
          this.startTable(
            container,
            delims.map((cell) => alignOf(cell.text)),
          )
          return 2
        }
      }
      if (container.kind === 'paragraph' && SETEXT.test(rest)) {
        this.closeUnmatched()
        container.kind = 'heading'
        container.level = rest[0] === '=' ? 1 : 2
        this.touch(container)
        this.pos = text.length
        this.started = container
        return 2
      }
      if (HR.test(rest)) {
        this.started = this.addChild('hr')
        this.pos = text.length
        return 2
      }
    }
    if (!this.indented || container.kind === 'list') {
      const bullet = /^[*+-]/.exec(rest)
      const ordered = bullet ? null : /^(\d{1,9})([.)])/.exec(rest)
      const marker = bullet?.[0] ?? ordered?.[0]
      if (
        marker &&
        (!ordered || container.kind !== 'paragraph' || ordered[1] === '1') &&
        (rest.length === marker.length || isSpace(rest[marker.length])) &&
        !(container.kind === 'paragraph' && !rest.slice(marker.length).trim())
      ) {
        const markerOffset = this.indent
        this.advanceNextNonspace()
        this.advance(marker.length)
        const spacesCol = this.col
        const spacesPos = this.pos
        while (this.col - spacesCol < 5 && isSpace(text[this.pos])) this.advance(1, true)
        const spaces = this.col - spacesCol
        const blankItem = this.pos >= text.length
        let padding = marker.length + spaces
        if (spaces >= 5 || spaces < 1 || blankItem) {
          padding = marker.length + 1
          this.col = spacesCol
          this.pos = spacesPos
          if (isSpace(text[this.pos])) this.advance(1, true)
        }
        this.closeUnmatched()
        const type = bullet ? bullet[0] : ordered![2]!
        if (
          this.tip.kind !== 'list' ||
          this.tip.marker !== type ||
          this.tip.ordered !== !!ordered
        ) {
          const list = this.addChild('list')
          list.ordered = !!ordered
          list.marker = type
          list.startNumber = ordered ? Number(ordered[1]) : 1
        }
        const item = this.addChild('item')
        item.offset = markerOffset
        item.padding = padding
        return 1
      }
    }
    if (this.indented && this.tip.kind !== 'paragraph' && !this.blank) {
      this.advance(4, true)
      this.addChild('code')
      return 2
    }
    return 0
  }

  incorporate(line: Line) {
    this.line = line
    this.pos = 0
    this.col = 0
    this.started = null
    let container = this.doc
    this.oldtip = this.tip
    let last: BNode | undefined
    while ((last = container.children[container.children.length - 1]) && last.open) {
      container = last
      this.findNonspace()
      const result = this.continueBlock(container)
      if (result === 2) return
      if (result === 1) {
        container = container.parent!
        break
      }
    }
    this.allClosed = container === this.oldtip
    this.lastMatched = container

    // The line still being written: hold back what may turn into something else.
    if (this.partial && !line.complete) {
      this.findNonspace()
      const rest = this.rest
      if (container.kind === 'code') {
        const fence = container.fence
        if (fence && this.indent < 4 && new RegExp(`^\\${fence.ch}+[ \\t]*$`).test(rest)) return
      } else {
        if (
          container.kind === 'paragraph' &&
          container === this.tip &&
          TABLE_DELIM_PARTIAL.test(rest) &&
          (rest.includes('|') || container.lines[container.lines.length - 1]!.text.includes('|'))
        ) {
          // a delimiter row half written: show the table with its header already
          const header = splitRow(container.lines[container.lines.length - 1]!.text)
          const given = splitRow(rest)
          if (header.length > 1 || rest.includes('|')) {
            this.startTable(
              container,
              header.map((_, index) => alignOf(given[index]?.text ?? '')),
            )
            return
          }
        }
        if (MARKER_ONLY.test(rest) || CONTAINER_PARTIAL.test(rest)) return
      }
    }

    // a matched code block or table takes the rest of the line as it is
    const matchedLeaf = container.kind !== 'paragraph' && acceptsLines(container.kind)
    if (!matchedLeaf)
      for (;;) {
        this.findNonspace()
        if (!this.indented && !MAYBE_SPECIAL.test(this.rest)) {
          this.advanceNextNonspace()
          break
        }
        const result = this.tryStart(container)
        if (result === 0) {
          this.advanceNextNonspace()
          break
        }
        container = this.tip
        if (result === 2) break
      }

    if (!this.allClosed && !this.blank && this.tip.kind === 'paragraph') {
      // a lazy continuation line
      this.addLine()
      return
    }
    this.closeUnmatched()
    if (container === this.started || container.kind === 'heading' || container.kind === 'hr')
      return
    if (acceptsLines(container.kind)) {
      if (container.kind !== 'code' || container.fence || !this.blank || container.lines.length)
        this.addLine()
    } else if (!this.blank) {
      this.addChild('paragraph')
      this.advanceNextNonspace()
      this.addLine()
    }
  }

  run(source: string, from: number) {
    let start = from
    let number = 0
    while (start < source.length) {
      const nl = source.indexOf('\n', start)
      const end = nl < 0 ? source.length : nl
      let text = source.slice(start, end)
      if (text.endsWith('\r')) text = text.slice(0, -1)
      this.incorporate({ text, start, complete: nl >= 0, number: number++ })
      start = end + 1
    }
    const lastComplete = source.length === from || source[source.length - 1] === '\n'
    if (!this.partial) {
      this.ending = true
      while (this.tip !== this.doc) this.finalize(this.tip)
    } else {
      // definitions at the start of a paragraph that is still open
      for (let b: BNode | null = this.tip; b && b !== this.doc; b = b.parent)
        if (b.kind === 'paragraph') this.extractDefs(b)
    }
    let tip: BNode | null = null
    if (this.partial && this.tip !== this.doc) {
      const kind = this.tip.kind
      if (kind === 'paragraph' || kind === 'code' || (!lastComplete && acceptsLeaf(kind)))
        tip = this.tip
    }
    return {
      blocks: this.doc.children,
      stable: this.stable,
      resume: this.resume,
      refs: this.refs,
      stableLabels: this.stableLabels,
      tip,
      complete: lastComplete,
    } satisfies BlockParseResult
  }
}

function lastOpen(block: BNode): BNode | null {
  const last = block.children[block.children.length - 1]
  return last?.open ? last : null
}

const acceptsLeaf = (kind: BlockKind) => kind === 'heading' || kind === 'table'

/**
 * Parse the block structure of `source` from offset `from` (a point where
 * nothing is open). With `partial`, the source is the start of a stream.
 */
export function parseBlocks(source: string, from = 0, partial = false): BlockParseResult {
  return new BlockParser(partial, from).run(source, from)
}
