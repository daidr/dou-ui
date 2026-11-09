// @vitest-environment node
import { Window } from 'happy-dom'
import { DOMParser as LinkedomParser } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { blocksToMarkdown, markdownToBlocks } from '..'
import { htmlToBlocks } from '../../core/convert'
import { editorKit } from '../../extensions/editor-kit'

const extensions = [editorKit()]

const MARKDOWN = `# Plan

Some **bold** text, \`code\` and a [link](https://example.com).

- one
- two
  - nested

1. first
2. second

- [ ] to do
- [x] done

> [!TIP]
> Mind this.

> A quote

| a | b |
| --- | --- |
| 1 | 2 |

\`\`\`ts
const x = 1
\`\`\`
`

describe('markdownToBlocks without a browser', () => {
  it('has no DOMParser here', () => {
    expect(typeof DOMParser).toBe('undefined')
    expect(() => markdownToBlocks('# Hi', extensions)).toThrow(
      'markdownToBlocks(markdown, extensions, { domParser })',
    )
    expect(() => htmlToBlocks('<p>Hi</p>', extensions)).toThrow(
      'htmlToBlocks(html, extensions, { domParser })',
    )
  })

  it('reads Markdown with a DOM library’s DOMParser as the browser does', () => {
    const window = new Window()
    const blocks = markdownToBlocks(MARKDOWN, extensions, { domParser: new window.DOMParser() })
    expect(blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'bulletItem',
      'bulletItem',
      'numberedItem',
      'numberedItem',
      'checkItem',
      'checkItem',
      'callout',
      'quote',
      'table',
      'codeBlock',
    ])
    expect(blocksToMarkdown(blocks, extensions)).toBe(MARKDOWN)
  })

  it('reads with linkedom, which leaves the body of a bare fragment empty', () => {
    const blocks = markdownToBlocks(MARKDOWN, extensions, { domParser: new LinkedomParser() })
    expect(blocks).toHaveLength(12)
    expect(blocksToMarkdown(blocks, extensions)).toBe(MARKDOWN)
  })

  it('reads HTML with a DOM library too, a whole page as well as a fragment', () => {
    const domParser = new LinkedomParser()
    const fragment = htmlToBlocks('<h2>上海</h2><p>晴</p>', extensions, { domParser })
    expect(fragment.map((block) => block.type)).toEqual(['heading', 'paragraph'])
    const page = htmlToBlocks(
      '<!doctype html><html><head><title>天气</title></head><body><p>晴</p></body></html>',
      extensions,
      { domParser: new new Window().DOMParser() },
    )
    expect(page.map((block) => block.type)).toEqual(['paragraph'])
  })
})
