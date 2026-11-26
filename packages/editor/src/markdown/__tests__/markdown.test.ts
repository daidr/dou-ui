import { mount } from '@vue/test-utils'
import { DouMarkdown, parseMarkdown } from 'dou-ui'
import { describe, expect, it } from 'vitest'
import { blocksToMarkdown, markdownToBlocks } from '..'
import { blocksToHTML, htmlToBlocks } from '../../core/convert'
import { defineEditorExtension } from '../../core/extension'
import type { Block, InlineContent, PartialBlock } from '../../core/model'
import { textBlock } from '../../core/schema'
import { image } from '../../extensions/image'
import { mention } from '../../extensions/mention'
import { editorKit } from '../../extensions/editor-kit'

const extensions = [editorKit(), image(), mention({ search: () => [] })]

/** Blocks without ids, for comparing. */
function shape(blocks: Block[]): unknown[] {
  return blocks.map((block) => ({
    type: block.type,
    props: block.props,
    content: block.content,
    children: shape(block.children),
  }))
}

const block = (partial: Omit<PartialBlock, 'children'> & { children?: Block[] }): Block => ({
  id: 'x',
  type: partial.type ?? 'paragraph',
  props: partial.props ?? {},
  content: (partial.content as InlineContent[]) ?? [],
  children: partial.children ?? [],
})

const text = (value: string, marks?: string[], link?: string): InlineContent => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
  ...(link ? { link } : {}),
})

const document = `# 周报

本周 **完成** 了 *首页* 改版，~~旧版~~ 已下线，见 [记录](https://ui.daidr.me/guide)。

- 设计
  - 图标
- 前端

1. 评审
2. 上线

- [x] 写文档
- [ ] 发版

> 先做减法
>
> 再做加法

> [!WARNING]
> 周五停机维护

\`\`\`ts
const city = '上海'
\`\`\`

---

<details>
<summary>细节</summary>

折叠的内容

</details>

![海报](https://example.com/poster.png "上海站")

请 <span data-mention="daidr">@戴兜</span> 确认。
`

describe('Markdown', () => {
  it('reads every built-in block and writes the same Markdown back', () => {
    const blocks = markdownToBlocks(document, extensions)
    expect(blocks.map((item) => item.type)).toEqual([
      'heading',
      'paragraph',
      'bulletItem',
      'bulletItem',
      'numberedItem',
      'numberedItem',
      'checkItem',
      'checkItem',
      'quote',
      'callout',
      'codeBlock',
      'divider',
      'toggle',
      'image',
      'paragraph',
    ])
    expect(blocks[0]!.props.level).toBe(1)
    expect(blocks[2]!.children[0]!.content).toEqual([text('图标')])
    expect(blocks[6]!.props.checked).toBe(true)
    expect(blocks[8]!.children[0]!.content).toEqual([text('再做加法')])
    expect(blocks[9]!.props.tone).toBe('warning')
    expect(blocks[9]!.content).toEqual([text('周五停机维护')])
    expect(blocks[10]!.content).toEqual([text("const city = '上海'")])
    expect(blocks[12]!.children[0]!.content).toEqual([text('折叠的内容')])
    expect(blocks[13]!.props).toMatchObject({ alt: '海报', caption: '上海站' })
    expect(blocks[14]!.content[1]).toEqual({
      type: 'inline',
      name: 'mention',
      props: { id: 'daidr', label: '戴兜' },
    })
    expect(blocksToMarkdown(blocks, extensions)).toBe(document)
    expect(blocks.every((item) => item.id)).toBe(true)
  })

  it('escapes text that would read as Markdown', () => {
    const blocks = [
      block({ content: [text('# 不是标题')] }),
      block({ content: [text('1. 不是列表')] }),
      block({ content: [text('*星号* [方括号] <span> a_b_c')] }),
    ]
    const markdown = blocksToMarkdown(blocks, extensions)
    expect(markdown).toBe(
      '\\# 不是标题\n\n1\\. 不是列表\n\n\\*星号\\* \\[方括号\\] \\<span\\> a\\_b\\_c\n',
    )
    expect(shape(markdownToBlocks(markdown, extensions))).toEqual(shape(blocks))
  })

  it('keeps spaces outside the delimiters and nests overlapping marks', () => {
    const blocks = [
      block({
        content: [
          text('一 '),
          text('粗 ', ['bold']),
          text('粗斜', ['bold', 'italic']),
          text(' 完'),
        ],
      }),
    ]
    const markdown = blocksToMarkdown(blocks, extensions)
    expect(markdown).toBe('一 **粗 *粗斜*** 完\n')
    expect(shape(markdownToBlocks(markdown, extensions))).toEqual(shape(blocks))
  })

  it('writes tags where a delimiter could not open or close in non-CJK boundaries', () => {
    // non-CJK punctuation adjacent to non-CJK letters cannot open/close emphasis or strikethrough
    const cases: [Block, string][] = [
      [
        block({ content: [text('a'), text('(b)', ['bold']), text('c')] }),
        'a<strong>(b)</strong>c\n',
      ],
      [block({ content: [text('a'), text('(b)', ['italic']), text('c')] }), 'a<em>(b)</em>c\n'],
      [block({ content: [text('a'), text('(b)', ['strike']), text('c')] }), 'a<s>(b)</s>c\n'],
      [
        block({ content: [text('a'), text('“hi”', ['bold']), text('b')] }),
        'a<strong>“hi”</strong>b\n',
      ],
      [block({ content: [text('a'), text('😀', ['bold']), text('b')] }), 'a<strong>😀</strong>b\n'],
      [
        block({ content: [text('a'), text('foo)\ufe00', ['bold']), text('b')] }),
        'a<strong>foo)\ufe00</strong>b\n',
      ],
    ]
    for (const [input, expected] of cases) {
      const markdown = blocksToMarkdown([input], extensions)
      expect(markdown).toBe(expected)
      expect(shape(markdownToBlocks(markdown, extensions))).toEqual(shape([input]))
    }
  })

  it('parses CJK-friendly emphasis and strikethrough adjacent to punctuation', () => {
    const cases: [string, InlineContent[]][] = [
      [
        '制作了**桌面工作台（1280×860）**与**移动端 PWA（390×800）**两套',
        [
          text('制作了'),
          text('桌面工作台（1280×860）', ['bold']),
          text('与'),
          text('移动端 PWA（390×800）', ['bold']),
          text('两套'),
        ],
      ],
      ['这是**「重要」**内容', [text('这是'), text('「重要」', ['bold']), text('内容')]],
      ['这是**『双引号』**内容', [text('这是'), text('『双引号』', ['bold']), text('内容')]],
      ['这是**《书名》**内容', [text('这是'), text('《书名》', ['bold']), text('内容')]],
      ['这是**【重点】**内容', [text('这是'), text('【重点】', ['bold']), text('内容')]],
      ['这是**“引号”**测试', [text('这是'), text('“引号”', ['bold']), text('测试')]],
      ['这是**‘单引号’**测试', [text('这是'), text('‘单引号’', ['bold']), text('测试')]],
      ['他说**“好”**然后走了', [text('他说'), text('“好”', ['bold']), text('然后走了')]],
      ['支持**测试！**后面', [text('支持'), text('测试！', ['bold']), text('后面')]],
      ['包含~~删除（测试）~~内容', [text('包含'), text('删除（测试）', ['strike']), text('内容')]],
      ['包含~~「删除」~~内容', [text('包含'), text('「删除」', ['strike']), text('内容')]],
      ['包含~~“删除”~~内容', [text('包含'), text('“删除”', ['strike']), text('内容')]],
      ['这是*「斜体」*内容', [text('这是'), text('「斜体」', ['italic']), text('内容')]],
      ['这是*（测试）*后面', [text('这是'), text('（测试）', ['italic']), text('后面')]],
      ['这是*“引号”*测试', [text('这是'), text('“引号”', ['italic']), text('测试')]],
      [
        '这是***「粗斜」***内容',
        [text('这是'), text('「粗斜」', ['bold', 'italic']), text('内容')],
      ],
      ['中文**(测试)**中文', [text('中文'), text('(测试)', ['bold']), text('中文')]],
      ['这是**100%**成功', [text('这是'), text('100%', ['bold']), text('成功')]],
      ['价格**$99**起', [text('价格'), text('$99', ['bold']), text('起')]],
      ['a**（测试）**b', [text('a'), text('（测试）', ['bold']), text('b')]],
      ['**桌面工作台（1280×860）**test', [text('桌面工作台（1280×860）', ['bold']), text('test')]],
      ['这是**😀**测试', [text('这是'), text('😀', ['bold']), text('测试')]],
      ['これは**「重要」**です', [text('これは'), text('「重要」', ['bold']), text('です')]],
      ['**日本語（テスト）**です', [text('日本語（テスト）', ['bold']), text('です')]],
      ['이것은**「중요」**합니다', [text('이것은'), text('「중요」', ['bold']), text('합니다')]],
      ['**한국어(테스트)**입니다', [text('한국어(테스트)', ['bold']), text('입니다')]],
      ['𠀀**“测试”**𠀁', [text('𠀀'), text('“测试”', ['bold']), text('𠀁')]],
      // underscore respects word boundaries while still working with punctuation / whitespace
      ['这是，_「重要」_！后面', [text('这是，'), text('「重要」', ['italic']), text('！后面')]],
      ['（_重要_）', [text('（'), text('重要', ['italic']), text('）')]],
      [' _「重要」_ ', [text('「重要」', ['italic'])]],
    ]

    for (const [markdown, expected] of cases) {
      const blocks = markdownToBlocks(markdown, extensions)
      expect(blocks).toHaveLength(1)
      expect(blocks[0]!.content).toEqual(expected)
    }

    // Ideographic Variation Selector and fullwidth quote SVS (U+FE01) before delimiter
    expect(markdownToBlocks('葛\u{e0100}**“测试”**测试', extensions)[0]!.content).toEqual([
      text('葛\u{e0100}'),
      text('“测试”', ['bold']),
      text('测试'),
    ])
    expect(markdownToBlocks('**test\u201d\ufe01**b', extensions)[0]!.content).toEqual([
      text('test\u201d\ufe01', ['bold']),
      text('b'),
    ])
  })

  it('preserves CommonMark compatibility for non-CJK and intraword underscores', () => {
    const plainCases = [
      'foo_bar_baz',
      'foo__bar__baz',
      'a**(b)**c',
      'a*(b)*c',
      'a~~(b)~~c',
      'a**“hi”**b',
      'a**😀**b',
      '这是_「重要」_内容',
      '这是__「重要」__内容',
    ]

    for (const source of plainCases) {
      const blocks = markdownToBlocks(source, extensions)
      expect(blocks).toHaveLength(1)
      expect(blocks[0]!.content).toEqual([text(source)])
    }
  })

  it('round-trips CJK punctuation emphasis as pure Markdown and renders cleanly in DouMarkdown', () => {
    const samples = [
      '制作了**桌面工作台（1280×860）**与**移动端 PWA（390×800）**两套',
      '这是**「重要」**内容',
      '这是**“引号”**测试',
      '他说**“好”**然后走了',
      '支持**测试！**后面',
      '包含~~删除（测试）~~内容',
      '这是*「斜体」*内容',
      '这是***「粗斜」***内容',
      '中文**(测试)**中文',
      'a**（测试）**b',
      '这是**100%**成功',
      '𠀀**“测试”**𠀁',
    ]

    for (const sample of samples) {
      const first = markdownToBlocks(sample, extensions)
      const exported = blocksToMarkdown(first, extensions)
      expect(exported).toBe(`${sample}\n`)
      expect(exported).not.toMatch(/<\/?(strong|em|s)>/)
      expect(shape(markdownToBlocks(exported, extensions))).toEqual(shape(first))

      // Verify DouMarkdown renders the exported Markdown without literal HTML tags or raw markers
      const mdBlocks = parseMarkdown(exported)
      expect(mdBlocks).toHaveLength(1)
      const wrapper = mount(DouMarkdown, { props: { content: exported } })
      const renderedText = wrapper.text()
      expect(renderedText).not.toContain('<strong>')
      expect(renderedText).not.toContain('<em>')
      expect(renderedText).not.toContain('<s>')
      expect(renderedText).not.toContain('**')
      expect(renderedText).not.toContain('~~')
      expect(wrapper.findAll('strong, em, del, s').length).toBeGreaterThan(0)
      wrapper.unmount()
    }
  })

  it('uses Markdown delimiters when trailing spaces move outside punctuation', () => {
    const blocks = [block({ content: [text('a '), text('(b) ', ['bold']), text('c')] })]
    const markdown = blocksToMarkdown(blocks, extensions)
    expect(markdown).toBe('a **(b)** c\n')
    expect(markdownToBlocks(markdown, extensions)[0]!.content).toEqual([
      text('a '),
      text('(b)', ['bold']),
      text(' c'),
    ])
  })

  it('fences code that holds backticks, and leaves out unsafe links', () => {
    const blocks = [
      block({ type: 'codeBlock', props: { language: 'md' }, content: [text('```js\nx\n```')] }),
      block({ content: [text('a', ['code']), text('坏链接', undefined, 'javascript:alert(1)')] }),
      block({ content: [text('`x`', ['code'])] }),
    ]
    expect(blocksToMarkdown(blocks, extensions)).toBe(
      '````md\n```js\nx\n```\n````\n\n`a`坏链接\n\n`` `x` ``\n',
    )
  })

  it('writes line breaks and keeps paragraphs under a list item', () => {
    const blocks = [
      block({
        type: 'bulletItem',
        content: [text('第一行'), { type: 'break' }, text('第二行')],
        children: [block({ content: [text('补充说明')] })],
      }),
    ]
    const markdown = blocksToMarkdown(blocks, extensions)
    expect(markdown).toBe('- 第一行\\\n  第二行\n\n  补充说明\n')
    expect(shape(markdownToBlocks(markdown, extensions))).toEqual(shape(blocks))
  })

  it('leaves out what no extension reads', () => {
    const blocks = markdownToBlocks('<script>alert(1)</script>\n\n| a |\n| - |\n| b |\n', [
      editorKit({ table: false }),
    ])
    expect(blocks.map((item) => item.type)).toEqual(['paragraph'])
    expect(JSON.stringify(blocks)).not.toContain('alert')
  })

  it('takes a custom renderer', () => {
    const blocks = markdownToBlocks('任意', extensions, { render: () => '<h2>换过了</h2>' })
    expect(blocks[0]!).toMatchObject({ type: 'heading', props: { level: 2 } })
  })
})

describe('HTML', () => {
  it('writes clean HTML and reads it back', () => {
    const blocks = markdownToBlocks(document, extensions)
    const html = blocksToHTML(blocks, extensions)
    expect(html).not.toContain('dou-editor')
    expect(html).toContain('<ul>\n<li>设计<ul><li>图标</li></ul></li>\n<li>前端</li>\n</ul>')
    expect(html).toContain('<ol>\n<li>评审</li>\n<li>上线</li>\n</ol>')
    expect(html).toContain('<aside data-callout="warning"><p>周五停机维护</p></aside>')
    expect(html).toContain('<details><summary>细节</summary><p>折叠的内容</p></details>')
    expect(shape(htmlToBlocks(html, extensions))).toEqual(shape(blocks))
  })

  it('escapes text and attributes', () => {
    const html = blocksToHTML(
      [block({ content: [text('<b>&"', undefined, 'https://a.b/?q="x"')] })],
      extensions,
    )
    expect(html).toBe('<p><a href="https://a.b/?q=&quot;x&quot;">&lt;b&gt;&amp;&quot;</a></p>')
  })

  it('uses what custom extensions declare', () => {
    const note = defineEditorExtension({
      name: 'note',
      blocks: {
        note: textBlock('note', {
          parseDOM: [{ tag: 'div[data-content-type="note"]' }, { tag: 'section.note' }],
        }),
      },
      output: {
        blocks: {
          note: {
            html: (_block, { content }) => `<section class="note">${content}</section>`,
            markdown: (_block, { content }) => `NOTE: ${content}`,
          },
        },
      },
    })
    const list = [editorKit(), note]
    const blocks = [block({ type: 'note', content: [text('记得带伞')] })]
    expect(blocksToHTML(blocks, list)).toBe('<section class="note">记得带伞</section>')
    expect(blocksToMarkdown(blocks, list)).toBe('NOTE: 记得带伞\n')
    expect(htmlToBlocks('<section class="note">记得带伞</section>', list)[0]!.type).toBe('note')
  })
})
