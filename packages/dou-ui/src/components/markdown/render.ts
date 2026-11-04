import { CheckIcon } from '@dou-ui/icons'
import {
  defineComponent,
  Fragment,
  h,
  inject,
  type InjectionKey,
  type PropType,
  type VNode,
  type VNodeChild,
} from 'vue'
import type { ChatSource } from '../chat-sources/chat-sources'
import DouChatCitation from '../chat-sources/chat-citation.vue'
import DouCodeBlock from '../code-block/code-block.vue'
import type {
  MarkdownBlock,
  MarkdownInline,
  MarkdownListItem,
  MarkdownSlots,
  MarkdownTableRow,
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
  readonly linkTarget: string
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
}

export const markdownContextKey: InjectionKey<MarkdownRenderContext> = Symbol('dou-markdown')

const B = 'dou-markdown'
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

const CITATION = /\[(\d{1,3})\]/g

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
    const index = Number(match[1])
    const source = sources[index - 1]
    if (!source) continue
    if (match.index > last) text(ctx, value.slice(last, match.index), at + last, out, fade)
    out.push(
      h(DouChatCitation, {
        key: `c${at + match.index}`,
        class: stepOf(ctx, at + match.index) ? ENTER : undefined,
        index,
        source,
      }),
    )
    last = match.index + match[0].length
  }
  if (last < value.length) text(ctx, value.slice(last), at + last, out, fade)
}

function inlines(
  ctx: MarkdownRenderContext,
  nodes: MarkdownInline[],
  fade: boolean,
  out: VNodeChild[] = [],
): VNodeChild[] {
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        textWithCitations(ctx, node.value, node.at, out, fade)
        break
      case 'code':
        out.push(h('code', { class: fade ? enter(ctx, node.at) : undefined }, node.value))
        break
      case 'strong':
      case 'em':
      case 'del':
        out.push(h(node.type, inlines(ctx, node.children, fade)))
        break
      case 'link': {
        const href = node.href === undefined ? undefined : ctx.sanitize(node.href, 'link')
        const children = inlines(ctx, node.children, fade)
        if (href === undefined) {
          // an address still being written, or one that was dropped
          out.push(h('span', { class: `${B}__link` }, children))
          break
        }
        const external = !!ctx.linkTarget && ctx.linkTarget !== '_self' && !href.startsWith('#')
        out.push(
          h(
            'a',
            {
              href,
              title: node.title,
              target: external ? ctx.linkTarget : undefined,
              rel: external ? 'noopener noreferrer' : undefined,
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
            ? h(Fragment, slot({ src, alt: node.alt, title: node.title }) as VNode[])
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

function renderItem(ctx: MarkdownRenderContext, item: MarkdownListItem, tick: number): VNode {
  const children: VNodeChild[] = []
  if (item.checked !== null) {
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
  row: MarkdownTableRow,
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

function renderBlock(
  ctx: MarkdownRenderContext,
  node: MarkdownBlock,
  tick: number,
): VNode | VNode[] {
  switch (node.type) {
    case 'paragraph':
      return h('p', leafContent(ctx, node, node.children))
    case 'heading':
      return h(`h${node.level}`, leafContent(ctx, node, node.children))
    case 'code': {
      const streaming = ctx.streaming && !node.closed
      const slot = ctx.slots.code
      if (slot)
        return h(
          'div',
          { class: `${B}__custom` },
          slot({ code: node.value, lang: node.lang, streaming }) as VNode[],
        )
      return h(DouCodeBlock, {
        class: [`${B}__code`, enter(ctx, node.start)],
        code: node.value,
        lang: node.lang || 'text',
        streaming,
      })
    }
    case 'hr':
      return h('hr', { class: enter(ctx, node.start) })
    case 'blockquote':
      return h('blockquote', { class: enter(ctx, node.start) }, blockList(node.children, tick))
    case 'list':
      return h(
        node.ordered ? 'ol' : 'ul',
        {
          start: node.ordered && node.startNumber !== 1 ? node.startNumber : undefined,
          class: node.children.every((item) => item.checked !== null)
            ? `${B}__task-list`
            : undefined,
        },
        node.children.map((item, index) =>
          h(MarkdownBlockView, {
            key: `item:${item.start}`,
            node: item,
            tick: index === node.children.length - 1 ? tick : 0,
          }),
        ),
      )
    case 'table': {
      const entering = enter(ctx, node.start)
      const fade = !entering
      return h('div', { class: [`${B}__table`, entering] }, [
        h('table', [
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
        ]),
      ])
    }
  }
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
    node: { type: Object as PropType<MarkdownBlock | MarkdownListItem>, required: true },
    tick: { type: Number, default: 0 },
  },
  setup(props) {
    const ctx = inject(markdownContextKey)!
    return () =>
      props.node.type === 'item'
        ? renderItem(ctx, props.node, props.tick)
        : renderBlock(ctx, props.node, props.tick)
  },
})

const MarkdownRowView = defineComponent({
  name: 'DouMarkdownRow',
  props: {
    row: { type: Object as PropType<MarkdownTableRow>, required: true },
    align: { type: Array as PropType<string[]>, required: true },
    fade: { type: Boolean, default: true },
    tick: { type: Number, default: 0 },
  },
  setup(props) {
    const ctx = inject(markdownContextKey)!
    return () => renderRow(ctx, props.row, props.align, 'td', props.fade)
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
