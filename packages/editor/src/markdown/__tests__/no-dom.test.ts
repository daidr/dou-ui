// @vitest-environment node
import { Window } from 'happy-dom'
import { describe, expect, it } from 'vitest'
import { blocksToMarkdown, markdownToBlocks } from '..'
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
    expect(() => markdownToBlocks('# Hi', extensions)).toThrow(/needs a DOMParser/)
  })

  it('reads Markdown with a DOM library’s DOMParser as the browser does', () => {
    const window = new Window()
    const blocks = markdownToBlocks(MARKDOWN, extensions, {
      domParser: new window.DOMParser() as never,
    })
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
})
