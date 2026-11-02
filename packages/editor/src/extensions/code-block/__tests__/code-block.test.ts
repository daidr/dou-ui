import { mount } from '@vue/test-utils'
import { DouConfigProvider } from 'dou-ui'
import { DOMParser } from 'prosemirror-model'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import { createEditorView } from '../../../core/editor'
import { resolveEditorExtensions } from '../../../core/extension'
import { readTokens, setFallbackHighlighter, type CodeHighlighter } from '../../../core/highlight'
import { docToBlocks, type PartialBlock } from '../../../core/model'
import DouEditor from '../../../editor.vue'
import { editorKit } from '../../editor-kit'

const flush = async () => {
  for (let i = 0; i < 4; i++) await new Promise((resolve) => setTimeout(resolve, 0))
}

// shiki's shape: lines of colored spans, the colors as custom properties
const fake: CodeHighlighter = (code, lang) =>
  `<pre class="shiki"><code>${code
    .split('\n')
    .map(
      (line) =>
        `<span class="line">${line
          .split(/(\s+)/)
          .map((word) =>
            /^\s*$/.test(word)
              ? word
              : `<span style="--shiki-light:#${lang === 'ts' ? '0a0' : 'a00'}">${word}</span>`,
          )
          .join('')}</span>`,
    )
    .join('\n')}</code></pre>`

let view: EditorView | undefined

afterEach(() => {
  view?.destroy()
  view = undefined
})

function create(blocks: PartialBlock[], highlight?: CodeHighlighter) {
  const element = document.createElement('div')
  document.body.append(element)
  view = createEditorView({
    element,
    kit: resolveEditorExtensions([editorKit({ codeBlock: { highlight } })]),
    blocks,
    placeholder: { text: () => '', heading: () => '', empty: () => '' },
  })
  return view
}

const tokens = (target: EditorView) =>
  [...target.dom.querySelectorAll<HTMLElement>('.dou-editor__token')].map((el) => [
    el.textContent,
    el.style.getPropertyValue('--shiki-light'),
  ])

describe('code highlighting', () => {
  it('reads the tokens and checks them against the code', () => {
    const code = 'let a\nb'
    expect(readTokens(fake(code, 'ts') as string, code)).toEqual([
      { from: 0, to: 3, style: '--shiki-light:#0a0', className: '' },
      { from: 4, to: 5, style: '--shiki-light:#0a0', className: '' },
      { from: 6, to: 7, style: '--shiki-light:#0a0', className: '' },
    ])
    expect(readTokens('<span style="color:red">other</span>', code)).toBeNull()
  })

  it('colors code blocks, and again after an edit', async () => {
    const target = create(
      [{ id: 'a', type: 'codeBlock', props: { language: 'ts' }, content: 'const x = 1' }],
      fake,
    )
    await flush()
    expect(tokens(target)).toEqual([
      ['const', '#0a0'],
      ['x', '#0a0'],
      ['=', '#0a0'],
      ['1', '#0a0'],
    ])
    target.dispatch(target.state.tr.insertText(' + y', target.state.doc.content.size - 2))
    await flush()
    expect(tokens(target).map(([text]) => text)).toEqual(['const', 'x', '=', '1', '+', 'y'])
    // the document keeps plain text
    expect(docToBlocks(target.state.doc)[0]!.content).toMatchObject([
      { type: 'text', text: 'const x = 1 + y' },
    ])
  })

  it('leaves code plain when the highlighter fails', async () => {
    const target = create([{ type: 'codeBlock', content: 'x' }], () => {
      throw new Error('unknown language')
    })
    await flush()
    expect(tokens(target)).toEqual([])
  })

  it('uses the fallback highlighter when the code block has none', async () => {
    const target = create([{ type: 'codeBlock', props: { language: 'js' }, content: 'a b' }])
    await flush()
    expect(tokens(target)).toEqual([])
    setFallbackHighlighter(target, fake)
    await flush()
    expect(tokens(target)).toEqual([
      ['a', '#a00'],
      ['b', '#a00'],
    ])
  })

  it('reads the language from pasted code', () => {
    const { schema } = resolveEditorExtensions([editorKit()])
    const element = document.createElement('div')
    element.innerHTML = '<pre><code class="language-python">print(1)</code></pre>'
    const blocks = docToBlocks(DOMParser.fromSchema(schema).parse(element))
    expect(blocks[0]).toMatchObject({ type: 'codeBlock', props: { language: 'python' } })
  })
})

describe('code block view', () => {
  it('takes the highlighter from ConfigProvider and shows the language', async () => {
    const wrapper = mount(
      () =>
        h(DouConfigProvider, { defaults: { DouCodeBlock: { highlight: fake } } }, () =>
          h(DouEditor, {
            modelValue: {
              version: 1,
              blocks: [{ type: 'codeBlock', props: { language: 'typescript' }, content: 'a' }],
            },
          }),
        ),
      { attachTo: document.body },
    )
    await flush()
    await nextTick()
    expect(wrapper.find('.dou-editor-code__language').text()).toBe('TypeScript')
    expect(wrapper.findAll('.dou-editor__token').map((el) => el.text())).toEqual(['a'])
    wrapper.unmount()
  })
})
