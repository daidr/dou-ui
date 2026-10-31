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

  it('writes tags where a delimiter could not open or close', () => {
    // `**` before a closing quote that is followed by a letter does not close
    const blocks = [block({ content: [text('他说'), text('“好”', ['bold']), text('然后走了')] })]
    const markdown = blocksToMarkdown(blocks, extensions)
    expect(markdown).toBe('他说<strong>“好”</strong>然后走了\n')
    expect(shape(markdownToBlocks(markdown, extensions))).toEqual(shape(blocks))
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
