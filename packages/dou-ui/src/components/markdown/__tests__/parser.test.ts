import { describe, expect, it } from 'vitest'
import type { MarkdownBlock, MarkdownInline } from '../markdown'
import { createMarkdownParser, parseMarkdown } from '../parser'
import { defaultSanitizeUrl } from '../url'

/** Blocks without positions, for comparing shapes. */
const shape = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (key, v) =>
      key === 'start' || key === 'end' || key === 'at' ? undefined : v,
    ),
  )

const inline = (source: string, partial = false): MarkdownInline[] => {
  const blocks = partial ? createMarkdownParser().update(source) : parseMarkdown(source)
  const first = blocks[0]
  return first && 'children' in first && first.type !== 'list' && first.type !== 'blockquote'
    ? shape(first.children)
    : []
}

const text = (value: string) => ({ type: 'text', value })

const SAMPLE = `# 上海三日游

为戴兜整理的行程，**注意：**周六可能有小雨。参考[天气](https://weather.example.com "预报")。
第二行 https://example.com/a_b_c，后面

- 外滩
- 豫园
  - 小笼包
- [x] 订酒店

1. 早上

2. 晚上

> 引用
懒续行
> - 列表

\`\`\`ts
const total = 1
\`\`\`

    缩进代码

| 景点 | 门票 |
| :-- | --: |
| 外滩 | 免费 |
| 豫园 \\| 城隍庙 | 40 |
表格后

Setext 标题
===

---
[站点]: https://travel.example.com
见 [站点] 和 ~~删除~~，以及 1~2 天。
`

describe('parseMarkdown', () => {
  it('reads blocks', () => {
    const blocks = parseMarkdown(SAMPLE)
    expect(blocks.map((b) => b.type)).toEqual([
      'heading',
      'paragraph',
      'list',
      'list',
      'blockquote',
      'code',
      'code',
      'table',
      'heading',
      'hr',
      'paragraph',
    ])
    const [, , bullets, ordered, quote, fenced, indented, table] = blocks as [
      MarkdownBlock,
      MarkdownBlock,
      Extract<MarkdownBlock, { type: 'list' }>,
      Extract<MarkdownBlock, { type: 'list' }>,
      Extract<MarkdownBlock, { type: 'blockquote' }>,
      Extract<MarkdownBlock, { type: 'code' }>,
      Extract<MarkdownBlock, { type: 'code' }>,
      Extract<MarkdownBlock, { type: 'table' }>,
    ]
    expect(bullets.tight).toBe(true)
    expect(bullets.children[2]!.checked).toBe(true)
    expect(bullets.children[1]!.children[1]!.type).toBe('list')
    expect(ordered.tight).toBe(false)
    expect(quote.children.map((b) => b.type)).toEqual(['paragraph', 'list'])
    expect(fenced).toMatchObject({ lang: 'ts', value: 'const total = 1', closed: true })
    expect(indented.value).toBe('缩进代码')
    expect(table.align).toEqual(['left', 'right'])
    expect(shape(table.rows[1]!.cells[0])).toEqual([text('豫园 | 城隍庙')])
    // a line right after a table is one more row, as on GitHub
    expect(shape(table.rows[2]!.cells)).toEqual([[text('表格后')], []])
  })

  it('reads inline syntax', () => {
    expect(inline('a **b** *c* `d` ~~e~~')).toEqual([
      text('a '),
      { type: 'strong', children: [text('b')] },
      text(' '),
      { type: 'em', children: [text('c')] },
      text(' '),
      { type: 'code', value: 'd' },
      text(' '),
      { type: 'del', children: [text('e')] },
    ])
    expect(inline('[x](/a "t") ![y](/b.png) <https://c.com>')).toEqual([
      { type: 'link', href: '/a', title: 't', children: [text('x')] },
      text(' '),
      { type: 'image', src: '/b.png', alt: 'y' },
      text(' '),
      { type: 'link', href: 'https://c.com', children: [text('https://c.com')] },
    ])
    expect(inline('a\\*b\\* &amp; &#x4e0a;')).toEqual([text('a*b* & 上')])
    expect(inline('a  \nb\\\nc')).toEqual([
      text('a'),
      { type: 'break' },
      text('b'),
      { type: 'break' },
      text('c'),
    ])
  })

  it('handles CJK text', () => {
    // CommonMark alone would not close the bold before a CJK character
    expect(inline('**注意：**这里')).toEqual([
      { type: 'strong', children: [text('注意：')] },
      text('这里'),
    ])
    expect(inline('上海\n北京')).toEqual([
      text('上海'),
      { type: 'softbreak', cjk: true },
      text('北京'),
    ])
    expect(inline('a\nb')).toEqual([text('a'), { type: 'softbreak' }, text('b')])
    // a single tilde is not strikethrough: 1~2 天
    expect(inline('1~2 天，3~4 天')).toEqual([text('1~2 天，3~4 天')])
    // a bare address stops at CJK punctuation
    expect(inline('见https://a.com/x，然后')[1]).toMatchObject({ href: 'https://a.com/x' })
  })

  it('keeps raw HTML as text', () => {
    expect(inline('<script>alert(1)</script>')).toEqual([text('<script>alert(1)</script>')])
    expect(parseMarkdown('<div>\nhi\n</div>')[0]!.type).toBe('paragraph')
  })

  it('reads reference links defined later', () => {
    expect(inline('see [a]\n\n[a]: https://a.com')).toEqual([
      text('see '),
      { type: 'link', href: 'https://a.com', children: [text('a')] },
    ])
  })
})

describe('createMarkdownParser', () => {
  it('gives the same blocks as parsing from scratch, at every step', () => {
    for (const step of [1, 4, 17]) {
      const parser = createMarkdownParser()
      for (let i = step; i < SAMPLE.length + step; i += step) {
        const source = SAMPLE.slice(0, i)
        expect(shape(parser.update(source))).toEqual(shape(createMarkdownParser().update(source)))
      }
      expect(shape(parser.update(SAMPLE, true))).toEqual(shape(parseMarkdown(SAMPLE)))
    }
  })

  it('freezes blocks that can no longer change and keeps them as the same objects', () => {
    const parser = createMarkdownParser()
    const first = parser.update('# 标题\n\n第一段\n\n第二')
    expect(parser.stable).toBe(2)
    const second = parser.update('# 标题\n\n第一段\n\n第二段继续')
    expect(second[0]).toBe(first[0])
    expect(second[1]).toBe(first[1])
    expect(second[2]).not.toBe(first[2])
  })

  it('keeps unchanged items of a growing list', () => {
    const parser = createMarkdownParser()
    const a = parser.update('- 一\n- 二\n- 三')
    const b = parser.update('- 一\n- 二\n- 三四')
    const listA = a[0] as Extract<MarkdownBlock, { type: 'list' }>
    const listB = b[0] as Extract<MarkdownBlock, { type: 'list' }>
    expect(listB).not.toBe(listA)
    expect(listB.children[0]).toBe(listA.children[0])
    expect(listB.children[1]).toBe(listA.children[1])
  })

  it('starts over when the source is replaced', () => {
    const parser = createMarkdownParser()
    parser.update('# a\n\nb\n\nc')
    expect(shape(parser.update('x\n\ny', true))).toEqual(shape(parseMarkdown('x\n\ny')))
  })
})

const stream = (source: string) => shape(createMarkdownParser().update(source))
const items = (source: string) =>
  (stream(source) as { children: { checked: unknown; children: unknown[] }[] }[])[0]!.children

describe('unfinished syntax while streaming', () => {
  it('shows unclosed emphasis and code already', () => {
    expect(inline('a **bold', true)).toEqual([
      text('a '),
      { type: 'strong', children: [text('bold')] },
    ])
    expect(inline('a **bold*', true)).toEqual([
      text('a '),
      { type: 'strong', children: [text('bold')] },
    ])
    expect(inline('a `code', true)).toEqual([text('a '), { type: 'code', value: 'code' }])
    expect(inline('a ~~gone', true)).toEqual([
      text('a '),
      { type: 'del', children: [text('gone')] },
    ])
  })

  it('hides markers that have nothing after them', () => {
    expect(inline('a **', true)).toEqual([text('a')])
    expect(inline('a `', true)).toEqual([text('a')])
    expect(inline('a [', true)).toEqual([text('a')])
    expect(inline('a \\', true)).toEqual([text('a')])
  })

  it('shows links before their address is complete', () => {
    expect(inline('see [docs](https://exa', true)).toEqual([
      text('see '),
      { type: 'link', children: [text('docs')] },
    ])
    expect(inline('see [docs', true)).toEqual([text('see docs')])
    // a citation being written shows nothing until it closes
    expect(inline('see [1', true)).toEqual([text('see ')])
    expect(inline('see ![pic](https://a.com/p', true)).toEqual([text('see ')])
  })

  it('holds back lines that may still turn into something else', () => {
    expect(stream('段落\n-')).toEqual(stream('段落'))
    expect(stream('段落\n\n1.')).toEqual(stream('段落\n\n'))
    expect(stream('段落\n\n##')).toEqual(stream('段落\n\n'))
    expect(stream('段落\n\n- ')).toEqual(stream('段落\n\n'))
  })

  it('waits for the delimiter row before showing a table, then shows it with its header', () => {
    expect(stream('| a | b |')).toEqual([])
    expect(stream('| a | b |\n')).toEqual([])
    const half = stream('| a | b |\n| -') as { type: string; head: unknown; rows: unknown[] }[]
    expect(half[0]).toMatchObject({ type: 'table', rows: [] })
    expect(shape(half[0]!.head)).toEqual({
      type: 'row',
      cells: [[text('a')], [text('b')]],
    })
    const row = stream('| a | b |\n|---|---|\n| 1 | 2') as { rows: { cells: unknown }[] }[]
    expect(row[0]!.rows[0]!.cells).toEqual([[text('1')], [text('2')]])
  })

  it('shows an open code fence as code, without a half-written closing fence', () => {
    expect(stream('```js\nlet a\n``')).toEqual([
      { type: 'code', lang: 'js', value: 'let a', closed: false },
    ])
  })

  it('shows a task box only once it is written out', () => {
    expect(items('- [x')[0]).toMatchObject({ checked: null, children: [] })
    expect(items('- [x] 完')[0]).toMatchObject({ checked: true })
  })
})

describe('defaultSanitizeUrl', () => {
  it('keeps safe addresses', () => {
    for (const url of [
      'https://a.com',
      'http://a.com',
      'mailto:a@b.c',
      'tel:123',
      '/a',
      'a/b:c',
      '#x',
      '?q=a:b',
    ])
      expect(defaultSanitizeUrl(url)).toBe(url)
  })

  it('drops scripts and data', () => {
    for (const url of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      ' javascript:alert(1)',
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      'vbscript:x',
      'data:text/html,<script>',
    ])
      expect(defaultSanitizeUrl(url)).toBeUndefined()
  })
})
