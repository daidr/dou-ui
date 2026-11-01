import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { setHighlight, setTextColor } from '..'
import { collaboration } from '../../../collaboration'
import { blocksToHTML, htmlToBlocks } from '../../../core/convert'
import { setBlockType } from '../../../core/commands'
import { EditorTransaction } from '../../../core/transaction'
import { createEditorView, getBlocks } from '../../../core/editor'
import { resolveEditorExtensions } from '../../../core/extension'
import { at, run, stateOf } from '../../../core/__tests__/helpers'
import { docToBlocks, type Block, type PartialBlock } from '../../../core/model'
import { blocksToMarkdown, markdownToBlocks } from '../../../markdown'
import { currentAlign, setAlign } from '../../align'
import { editorKit } from '../../editor-kit'

const extensions = [editorKit()]

const colored: PartialBlock[] = [
  {
    id: 'a',
    type: 'heading',
    props: { level: 2, align: 'center' },
    content: [
      { type: 'text', text: '上海', color: 'red' },
      { type: 'text', text: ' 外滩', marks: ['bold'], highlight: 'yellow' },
    ],
  },
  { id: 'b', content: 'plain' },
]

const strip = (blocks: Block[]) =>
  blocks.map((block) => ({ type: block.type, props: block.props, content: block.content }))

describe('colors and alignment', () => {
  it('keep colors and alignment in the blocks', () => {
    const blocks = docToBlocks(stateOf(colored).doc)
    expect(blocks[0]!.props).toEqual({ level: 2, align: 'center' })
    expect(blocks[0]!.content).toEqual([
      { type: 'text', text: '上海', color: 'red' },
      { type: 'text', text: ' 外滩', marks: ['bold'], highlight: 'yellow' },
    ])
    // no alignment, no prop
    expect(blocks[1]!.props).toEqual({})
  })

  it('write and read them as HTML', () => {
    const html = blocksToHTML(colored, extensions)
    expect(html).toContain('style="text-align: center"')
    expect(html).toContain('<span data-color="red">上海</span>')
    expect(html).toContain('<mark data-color="yellow">')
    expect(strip(htmlToBlocks(html, extensions))).toEqual(strip(docToBlocks(stateOf(colored).doc)))
  })

  it('read pasted alignment and plain highlights, and drop unknown colors', () => {
    const blocks = htmlToBlocks(
      '<p style="text-align: right">A <mark>B</mark> <span data-color="teal">C</span></p><p align="center">D</p>',
      extensions,
    )
    expect(blocks[0]!.props).toEqual({ align: 'right' })
    expect(blocks[0]!.content).toEqual([
      { type: 'text', text: 'A ' },
      { type: 'text', text: 'B', highlight: 'yellow' },
      { type: 'text', text: ' C' },
    ])
    expect(blocks[1]!.props).toEqual({ align: 'center' })
  })

  it('keep colors in Markdown as inline HTML, and drop alignment there', () => {
    const markdown = blocksToMarkdown(colored, extensions)
    expect(markdown).toBe(
      '## <span data-color="red">上海</span> <mark data-color="yellow">**外滩**</mark>\n\nplain\n',
    )
    const [heading] = markdownToBlocks(markdown, extensions)
    expect(heading!.props).toEqual({ level: 2 })
    // the space moves out of the marks, as Markdown wants
    expect(heading!.content).toEqual([
      { type: 'text', text: '上海', color: 'red' },
      { type: 'text', text: ' ' },
      { type: 'text', text: '外滩', marks: ['bold'], highlight: 'yellow' },
    ])
  })

  it('set colors on the selected text and clear them', () => {
    let state = at(stateOf([{ id: 'a', content: 'hello' }]), 'a', 0, 'a', 2)
    state = run(state, setTextColor('blue')).state
    state = run(state, setHighlight('green')).state
    expect(docToBlocks(state.doc)[0]!.content).toEqual([
      { type: 'text', text: 'he', color: 'blue', highlight: 'green' },
      { type: 'text', text: 'llo' },
    ])
    state = run(state, setTextColor(null)).state
    expect(docToBlocks(state.doc)[0]!.content[0]).toEqual({
      type: 'text',
      text: 'he',
      highlight: 'green',
    })
  })

  it('align the cursor block, and skip blocks that cannot be aligned', () => {
    let state = at(stateOf([{ id: 'a', content: 'x' }]), 'a')
    state = run(state, setAlign('center')).state
    expect(currentAlign(state)).toBe('center')
    expect(docToBlocks(state.doc)[0]!.props).toEqual({ align: 'center' })
    state = run(state, setAlign(null)).state
    expect(docToBlocks(state.doc)[0]!.props).toEqual({})
    const code = at(stateOf([{ id: 'c', type: 'codeBlock', content: 'x' }]), 'c')
    expect(run(code, setAlign('center')).ok).toBe(false)
  })

  it('report mixed alignment, and keep left as no alignment', () => {
    let state = at(
      stateOf([
        { id: 'a', props: { align: 'center' }, content: 'x' },
        { id: 'b', content: 'y' },
      ]),
      'a',
      0,
      'b',
      1,
    )
    expect(currentAlign(state)).toBe('mixed')
    state = run(state, setAlign('left')).state
    expect(docToBlocks(state.doc).map((block) => block.props)).toEqual([{}, {}])
    expect(currentAlign(state)).toBe(null)
    // pasted left is the default too
    expect(htmlToBlocks('<p style="text-align: left">A</p>', extensions)[0]!.props).toEqual({})
    expect(
      docToBlocks(stateOf([{ id: 'c', props: { align: 'left' }, content: 'z' }]).doc)[0]!.props,
    ).toEqual({})
  })

  it('drop invalid alignment and colors with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const [block] = docToBlocks(
      stateOf([
        {
          id: 'a',
          props: { align: 'middle' as never },
          content: [
            { type: 'text', text: 'x', color: 'teal' as never, highlight: '#ff0' as never },
          ],
        },
      ]).doc,
    )
    expect(block!.props).toEqual({})
    expect(block!.content).toEqual([{ type: 'text', text: 'x' }])
    const messages = warn.mock.calls.map((call) => String(call[0]))
    expect(messages.some((m) => m.includes('middle'))).toBe(true)
    expect(messages.some((m) => m.includes('teal'))).toBe(true)
    expect(messages.some((m) => m.includes('#ff0'))).toBe(true)
    warn.mockRestore()
  })

  it('write no alignment for blocks that cannot take it', () => {
    const html = blocksToHTML(
      [{ type: 'codeBlock', props: { align: 'center' } as never, content: 'x' }],
      extensions,
    )
    expect(html).not.toContain('text-align')
  })

  it('take the alignment keys even where nothing can be aligned', () => {
    const { keymaps } = resolveEditorExtensions([editorKit()])
    const bindings = Object.assign({}, ...keymaps) as Record<string, (...args: never[]) => boolean>
    const state = at(stateOf([{ id: 'a', type: 'bulletItem', content: 'x' }]), 'a')
    const command = bindings['Mod-Shift-r'] as unknown as Parameters<typeof run>[1]
    expect(run(state, command).ok).toBe(true)
    expect(docToBlocks(run(state, command).state.doc)[0]!.props).toEqual({})
  })

  it('keep alignment when the block changes type', () => {
    let state = at(stateOf([{ id: 'a', props: { align: 'center' }, content: 'x' }]), 'a')
    state = run(state, setBlockType('heading', { level: 1 })).state
    expect(docToBlocks(state.doc)[0]!.props).toEqual({ level: 1, align: 'center' })
    const tr = new EditorTransaction(state)
    tr.updateBlock('a', { type: 'quote' })
    expect(docToBlocks(tr.tr.doc)[0]!.props).toEqual({ align: 'center' })
    tr.updateBlock('a', { type: 'codeBlock' })
    expect(docToBlocks(tr.tr.doc)[0]!.props).toEqual({ language: '' })
  })

  it('reach collaborators', () => {
    const doc = new Y.Doc()
    const views = [0, 1].map(() => {
      const element = document.createElement('div')
      document.body.append(element)
      return createEditorView({
        element,
        kit: resolveEditorExtensions([editorKit(), collaboration({ map: doc.getMap('d') })]),
        placeholder: { text: () => '', heading: () => '', empty: () => '' },
      })
    })
    const [first, second] = views as [(typeof views)[0], (typeof views)[0]]
    const id = getBlocks(first)[0]!.id
    first.dispatch(first.state.tr.insertText('上海'))
    const state = at(first.state, id, 0, id, 2)
    first.updateState(state)
    setTextColor('red')(first.state, first.dispatch)
    setAlign('center')(first.state, first.dispatch)
    expect(getBlocks(second)[0]).toMatchObject({
      props: { align: 'center' },
      content: [{ type: 'text', text: '上海', color: 'red' }],
    })
    for (const view of views) view.destroy()
  })
})
