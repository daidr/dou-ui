import { CheckIcon } from '@dou-ui/icons'
import {
  defineComponent,
  Fragment,
  getCurrentInstance,
  h,
  inject,
  type ComponentInternalInstance,
  type InjectionKey,
  type PropType,
  type VNode,
  type VNodeChild,
} from 'vue'
import type { Tone } from '../../utils/types'
// through the installable entries, so ConfigProvider defaults reach them
import { DouAlert } from '../alert'
import { DouChatCitation } from '../chat-sources'
import type { ChatSource } from '../chat-sources/chat-sources'
import { DouCodeBlock } from '../code-block'
import type {
  MarkdownBlock,
  MarkdownContainer,
  MarkdownInline,
  MarkdownItem,
  MarkdownLinkTarget,
  MarkdownRow,
  MarkdownSlots,
  MarkdownUrlKind,
} from './markdown'

/** One reveal step: the text from `from` on arrived at `time`. */
export interface MarkdownCommit {
  from: number
  time: number
}

/** What the block components share; plain fields are read without tracking. */
export interface MarkdownRenderContext {
  readonly streaming: boolean
  readonly sources: ChatSource[] | undefined
  readonly linkTarget: MarkdownLinkTarget
  readonly slots: MarkdownSlots
  sanitize: (url: string, kind: MarkdownUrlKind) => string | undefined
  /** Reveal steps still fading in, oldest first. Empty when nothing animates. */
  commits: MarkdownCommit[]
  /** How long a fade lasts, in ms. */
  duration: number
  /** The time of the render in progress. */
  now: number
  /** `animation-delay` of each fading span, fixed when it is first drawn. */
  delays: Map<string, string>
  /** The block the caret follows, while streaming. */
  caret: object | null
  /** The block or row being drawn. */
  drawing: ComponentInternalInstance | null
  /** Blocks and rows drawn with fading spans, to draw again once the fades end. */
  fading: Set<ComponentInternalInstance>
}

export const markdownContextKey: InjectionKey<MarkdownRenderContext> = Symbol('dou-markdown')

const B = 'dou-markdown'
type AnySlot = (props: Record<string, unknown>) => unknown

/** The slot for a kind of node, the more specific name first. */
function slotOf(ctx: MarkdownRenderContext, ...names: string[]): AnySlot | undefined {
  const slots = ctx.slots as Record<string, AnySlot | undefined>
  for (const name of names) if (Object.hasOwn(slots, name) && slots[name]) return slots[name]
  return undefined
}

const group = (children: VNodeChild[]) => h(Fragment, children)
const output = (value: unknown) => h(Fragment, value as VNode[])

// sources with their address checked, kept per source so citations stay the same object
const checkedSources = new WeakMap<ChatSource, { url?: string; source: ChatSource }>()
function checkedSource(ctx: MarkdownRenderContext, source: ChatSource): ChatSource {
  if (!source.url) return source
  const hit = checkedSources.get(source)
  if (hit && hit.url === source.url) return hit.source
  const url = ctx.sanitize(source.url, 'source')
  const next = url === source.url ? source : { ...source, url }
  checkedSources.set(source, { url: source.url, source: next })
  return next
}
const FRESH = `${B}__fresh`
const ENTER = `${B}__enter`

/** The reveal step `offset` belongs to, while it is still fading. */
function stepOf(ctx: MarkdownRenderContext, offset: number): MarkdownCommit | undefined {
  const commits = ctx.commits
  if (!commits.length || offset < commits[0]!.from) return undefined
  let found: MarkdownCommit | undefined
  for (const commit of commits) {
    if (commit.from > offset) break
    found = commit
  }
  return found && ctx.now - found.time < ctx.duration ? found : undefined
}

/** Class for a block that fades in as a whole when it first shows. */
function enter(ctx: MarkdownRenderContext, offset: number): string | undefined {
  return stepOf(ctx, offset) ? ENTER : undefined
}

function caretNode() {
  return h('span', { class: `${B}__caret`, 'aria-hidden': 'true' })
}

/** Text, with the parts that are still fading in wrapped in spans. */
function text(
  ctx: MarkdownRenderContext,
  value: string,
  at: number,
  out: VNodeChild[],
  fade: boolean,
) {
  const commits = ctx.commits
  const end = at + value.length
  if (!fade || !commits.length || end <= commits[0]!.from) {
    out.push(value)
    return
  }
  let pos = 0
  for (let k = 0; k < commits.length; k++) {
    const commit = commits[k]!
    const to = commits[k + 1]?.from ?? Infinity
    const s = Math.max(commit.from, at) - at
    const e = Math.min(to, end) - at
    if (e <= s) continue
    if (s > pos) out.push(value.slice(pos, s))
    const age = ctx.now - commit.time
    if (age >= ctx.duration) out.push(value.slice(s, e))
    else {
      const key = `${at}:${commit.from}`
      let delay = ctx.delays.get(key)
      if (delay === undefined) {
        // drawn again from scratch, it picks up where the fade is
        delay = age >= 1 ? `${-Math.round(age)}ms` : ''
        ctx.delays.set(key, delay)
      }
      if (ctx.drawing) ctx.fading.add(ctx.drawing)
      out.push(
        h(
          'span',
          { key, class: FRESH, style: delay ? { animationDelay: delay } : undefined },
          value.slice(s, e),
        ),
      )
    }
    pos = e
  }
  if (pos < value.length) out.push(value.slice(pos))
}

/** `[1]`, `[^1]`, `[1, 2]`, `[1、2]`. */
const CITATION = /\[\^?(\d{1,3}(?:[ \t]*[,，、][ \t]*\d{1,3})*)\]/g
// `a[1].b` or `m[1](x)` is code, not a citation
const CODE_BEFORE = /[A-Za-z0-9_)]/
const CODE_AFTER = /[A-Za-z0-9_.(=]/

function citation(ctx: MarkdownRenderContext, index: number, source: ChatSource, at: number) {
  const checked = checkedSource(ctx, source)
  const slot = ctx.slots.citation
  if (slot)
    return h(Fragment, { key: `c${at}:${index}` }, slot({ index, source: checked }) as VNode[])
  return h(DouChatCitation, {
    key: `c${at}:${index}`,
    class: stepOf(ctx, at) ? ENTER : undefined,
    index,
    source: checked,
  })
}

function textWithCitations(
  ctx: MarkdownRenderContext,
  value: string,
  at: number,
  out: VNodeChild[],
  fade: boolean,
) {
  const sources = ctx.sources
  if (!sources?.length || !value.includes('[')) {
    text(ctx, value, at, out, fade)
    return
  }
  let last = 0
  for (const match of value.matchAll(CITATION)) {
    const end = match.index + match[0].length
    if (CODE_BEFORE.test(value[match.index - 1] ?? '') && CODE_AFTER.test(value[end] ?? ''))
      continue
    const indexes = match[1]!.split(/[ \t]*[,，、][ \t]*/).map(Number)
    // a number without a source leaves the whole bracket as text
    if (!indexes.every((index) => index >= 1 && sources[index - 1])) continue
    if (match.index > last) text(ctx, value.slice(last, match.index), at + last, out, fade)
    for (const index of indexes)
      out.push(citation(ctx, index, sources[index - 1]!, at + match.index))
    last = end
  }
  if (last < value.length) text(ctx, value.slice(last), at + last, out, fade)
}

/** A full address, which opens at `linkTarget`; relative ones and anchors open in place. */
const isExternal = (href: string) => /^(?:https?:)?\/\//i.test(href)

function inlines(
  ctx: MarkdownRenderContext,
  nodes: MarkdownInline[],
  fade: boolean,
  out: VNodeChild[] = [],
  inLink = false,
): VNodeChild[] {
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        // a citation is a link itself, so none inside a link
        if (inLink) text(ctx, node.value, node.at, out, fade)
        else textWithCitations(ctx, node.value, node.at, out, fade)
        break
      case 'code': {
        const slot = ctx.slots['inline-code']
        out.push(
          slot
            ? output(slot({ code: node.value }))
            : h('code', { class: fade ? enter(ctx, node.at) : undefined }, node.value),
        )
        break
      }
      case 'strong':
      case 'em':
      case 'del': {
        const children = inlines(ctx, node.children, fade, [], inLink)
        const slot = ctx.slots[node.type]
        out.push(slot ? output(slot({ children: group(children) })) : h(node.type, children))
        break
      }
      case 'link': {
        const href = node.href === undefined ? undefined : ctx.sanitize(node.href, 'link')
        const children = inlines(ctx, node.children, fade, [], true)
        const external = href !== undefined && isExternal(href)
        const slot = ctx.slots.link
        if (slot) {
          out.push(
            output(slot({ node, href, title: node.title, external, children: group(children) })),
          )
          break
        }
        if (href === undefined) {
          // an address still being written, or one that was dropped
          out.push(h('span', { class: `${B}__link` }, children))
          break
        }
        const target = external && ctx.linkTarget !== '_self' ? ctx.linkTarget : undefined
        out.push(
          h(
            'a',
            {
              href,
              title: node.title,
              target,
              rel: target ? 'noopener noreferrer' : undefined,
            },
            children,
          ),
        )
        break
      }
      case 'image': {
        const src = ctx.sanitize(node.src, 'image')
        if (src === undefined) {
          if (node.alt) out.push(node.alt)
          break
        }
        const slot = ctx.slots.image
        out.push(
          slot
            ? output(slot({ src, alt: node.alt, title: node.title }))
            : h('img', { src, alt: node.alt, title: node.title, loading: 'lazy' }),
        )
        break
      }
      case 'break':
        out.push(h('br'))
        break
      case 'softbreak':
        if (!node.cjk) out.push('\n')
        break
    }
  }
  return out
}

function leafContent(
  ctx: MarkdownRenderContext,
  owner: object,
  nodes: MarkdownInline[],
  fade = true,
): VNodeChild[] {
  const out = inlines(ctx, nodes, fade)
  if (ctx.caret === owner) out.push(caretNode())
  return out
}

function blockList(nodes: MarkdownBlock[], tick: number) {
  return nodes.map((node, index) =>
    h(MarkdownBlockView, {
      key: `${node.type}:${node.start}`,
      node,
      tick: index === nodes.length - 1 ? tick : 0,
    }),
  )
}

function renderItem(ctx: MarkdownRenderContext, item: MarkdownItem, tick: number): VNode {
  const children: VNodeChild[] = []
  const slot = ctx.slots.item
  if (item.checked !== null && !slot) {
    children.push(
      h('span', { class: `${B}__task` }, [
        h('input', {
          type: 'checkbox',
          class: `${B}__checkbox`,
          checked: item.checked,
          disabled: true,
        }),
        item.checked ? h(CheckIcon, { class: `${B}__check`, 'aria-hidden': 'true' }) : null,
      ]),
    )
  }
  const last = item.children.length - 1
  item.children.forEach((child, index) => {
    // a tight list shows its paragraphs without their own spacing
    if (item.tight && child.type === 'paragraph') {
      if (index > 0 && item.children[index - 1]!.type === 'paragraph') children.push(h('br'))
      children.push(...leafContent(ctx, child, child.children))
    } else {
      children.push(
        h(MarkdownBlockView, {
          key: `${child.type}:${child.start}`,
          node: child,
          tick: index === last ? tick : 0,
        }),
      )
    }
  })
  if (ctx.caret === item) children.push(caretNode())
  if (slot) return output(slot({ node: item, checked: item.checked, children: group(children) }))
  return h(
    'li',
    {
      class: [
        item.checked !== null && `${B}__task-item`,
        enter(ctx, item.start) && `${B}__item-enter`,
      ],
    },
    children,
  )
}

function renderRow(
  ctx: MarkdownRenderContext,
  row: MarkdownRow,
  align: string[],
  cell: 'th' | 'td',
  fade: boolean,
): VNode {
  const entering = fade ? enter(ctx, row.start) : undefined
  return h(
    'tr',
    { class: entering },
    row.cells.map((content, index) => {
      const out = inlines(ctx, content, fade && !entering)
      if (ctx.caret === row && index === row.cells.length - 1) out.push(caretNode())
      return h(cell, { style: align[index] ? { textAlign: align[index] } : undefined }, out)
    }),
  )
}

/** Tones of the containers drawn as an Alert when no slot takes them. */
const CALLOUTS = new Map<string, Tone>([
  ['note', 'neutral'],
  ['info', 'primary'],
  ['tip', 'success'],
  ['warning', 'warning'],
  ['danger', 'danger'],
])

function renderContainer(ctx: MarkdownRenderContext, node: MarkdownContainer, tick: number) {
  const entering = enter(ctx, node.start)
  const tone = CALLOUTS.get(node.name)
  if (tone)
    return h(
      DouAlert,
      // the content is part of the text, not an announcement
      { class: [`${B}__callout`, entering], tone, title: node.title || undefined, role: 'note' },
      { default: () => blockList(node.children, tick) },
    )
  return h('div', { class: [`${B}__container`, entering], 'data-name': node.name }, [
    node.title ? h('p', { class: `${B}__container-title` }, node.title) : null,
    ...blockList(node.children, tick),
  ])
}

function renderDefault(
  ctx: MarkdownRenderContext,
  node: MarkdownBlock,
  tick: number,
  children: () => VNodeChild[],
): VNode {
  switch (node.type) {
    case 'paragraph':
      return h('p', children())
    case 'heading':
      return h(`h${node.level}`, children())
    case 'hr':
      return h('hr', { class: enter(ctx, node.start) })
    case 'blockquote':
      return h('blockquote', { class: enter(ctx, node.start) }, children())
    case 'list':
      return h(
        node.ordered ? 'ol' : 'ul',
        {
          start: node.ordered && node.startNumber !== 1 ? node.startNumber : undefined,
          class: node.children.every((item) => item.checked !== null)
            ? `${B}__task-list`
            : undefined,
        },
        children(),
      )
    case 'table': {
      const entering = enter(ctx, node.start)
      return h('div', { class: [`${B}__table`, entering] }, children())
    }
    case 'code':
      return h(DouCodeBlock, {
        class: [`${B}__code`, enter(ctx, node.start)],
        code: node.value,
        lang: node.lang || 'text',
        streaming: ctx.streaming && !node.closed,
      })
    case 'container':
      return renderContainer(ctx, node, tick)
  }
}

function renderTable(
  ctx: MarkdownRenderContext,
  node: Extract<MarkdownBlock, { type: 'table' }>,
  tick: number,
) {
  const fade = !enter(ctx, node.start)
  return h('table', [
    h('thead', [renderRow(ctx, node.head, node.align, 'th', fade)]),
    node.rows.length
      ? h(
          'tbody',
          node.rows.map((row, index) =>
            h(MarkdownRowView, {
              key: row.start,
              row,
              align: node.align,
              fade,
              tick: index === node.rows.length - 1 ? tick : 0,
            }),
          ),
        )
      : null,
  ])
}

/** What a block holds: its text, or the blocks inside it. */
function inner(ctx: MarkdownRenderContext, node: MarkdownBlock, tick: number): VNodeChild[] {
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return leafContent(ctx, node, node.children)
    case 'blockquote':
    case 'container':
      return blockList(node.children, tick)
    case 'list':
      return node.children.map((item, index) =>
        h(MarkdownBlockView, {
          key: `item:${item.start}`,
          node: item,
          tick: index === node.children.length - 1 ? tick : 0,
        }),
      )
    case 'table':
      return [renderTable(ctx, node, tick)]
    default:
      return []
  }
}

function renderBlock(ctx: MarkdownRenderContext, node: MarkdownBlock, tick: number): VNode {
  const slot =
    node.type === 'code'
      ? slotOf(ctx, `code-${node.lang}`, 'code')
      : node.type === 'container'
        ? slotOf(ctx, `container-${node.name}`, 'container')
        : slotOf(ctx, node.type)
  if (!slot) return renderDefault(ctx, node, tick, () => inner(ctx, node, tick))
  const streaming = ctx.streaming && 'closed' in node && !node.closed
  const props: Record<string, unknown> =
    node.type === 'code'
      ? { node, code: node.value, lang: node.lang, streaming }
      : node.type === 'container'
        ? { node, name: node.name, title: node.title, streaming }
        : node.type === 'heading'
          ? { node, level: node.level }
          : { node }
  if (node.type !== 'code' && node.type !== 'hr') props.children = group(inner(ctx, node, tick))
  // the slot's content takes the block's spacing and fades in like the block would
  return h(
    'div',
    {
      class: [
        `${B}__custom`,
        node.type !== 'paragraph' && node.type !== 'heading' && enter(ctx, node.start),
      ],
    },
    slot(props) as VNode[],
  )
}

/**
 * One block. Its only input is the block object, which the parser hands
 * back unchanged while the block stays the same, so Vue skips it; `tick`
 * reaches only the last block on each level, which is where the stream
 * grows and where the caret sits.
 */
export const MarkdownBlockView = defineComponent({
  name: 'DouMarkdownBlock',
  props: {
    node: { type: Object as PropType<MarkdownBlock | MarkdownItem>, required: true },
    tick: { type: Number, default: 0 },
  },
  setup(props) {
    const ctx = inject(markdownContextKey)!
    const self = getCurrentInstance()
    return () => {
      ctx.drawing = self
      return props.node.type === 'item'
        ? renderItem(ctx, props.node, props.tick)
        : renderBlock(ctx, props.node, props.tick)
    }
  },
})

const MarkdownRowView = defineComponent({
  name: 'DouMarkdownRow',
  props: {
    row: { type: Object as PropType<MarkdownRow>, required: true },
    align: { type: Array as PropType<string[]>, required: true },
    fade: { type: Boolean, default: true },
    tick: { type: Number, default: 0 },
  },
  setup(props) {
    const ctx = inject(markdownContextKey)!
    const self = getCurrentInstance()
    return () => {
      ctx.drawing = self
      return renderRow(ctx, props.row, props.align, 'td', props.fade)
    }
  },
})

/** A run of blocks. Runs that are complete keep the same array, so a long document re-renders only its end. */
export const MarkdownChunkView = defineComponent({
  name: 'DouMarkdownChunk',
  props: {
    blocks: { type: Array as PropType<MarkdownBlock[]>, required: true },
    tick: { type: Number, default: 0 },
  },
  setup(props) {
    return () => h(Fragment, blockList(props.blocks, props.tick))
  },
})
