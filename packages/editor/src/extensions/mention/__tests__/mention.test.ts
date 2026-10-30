import { mount } from '@vue/test-utils'
import { DOMParser } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mention, type MentionItem } from '..'
import { findBlockById } from '../../../core/blocks'
import { createEditorView } from '../../../core/editor'
import { resolveEditorExtensions } from '../../../core/extension'
import { blocksToDoc, docToBlocks, type Block } from '../../../core/model'
import DouEditor from '../../../editor.vue'
import { editorKit } from '../../editor-kit'
import { getMention, setMentionItems } from '../state'

const people: MentionItem[] = [
  { id: 'u1', label: '戴兜', description: '设计' },
  { id: 'u2', label: '阿青', description: '前端' },
]
const search = (query: string) => people.filter((item) => item.label.includes(query))
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

let view: EditorView | undefined

afterEach(() => {
  view?.destroy()
  view = undefined
})

function create(text = '') {
  const element = document.createElement('div')
  document.body.append(element)
  view = createEditorView({
    element,
    kit: resolveEditorExtensions([editorKit(), mention({ search })]),
    blocks: [{ id: 'a', content: text }],
    placeholder: { text: () => '', heading: () => '', empty: () => '' },
  })
  const info = findBlockById(view.state.doc, 'a')!
  const end = info.contentPos + info.content.nodeSize - 1
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)))
  return view
}

/** Type like a keyboard: the text input handlers first, then the browser. */
function type(target: EditorView, text: string) {
  for (const char of text) {
    const { from, to } = target.state.selection
    const handled = target.someProp('handleTextInput', (handler) =>
      handler(target, from, to, char, () => target.state.tr.insertText(char, from, to)),
    )
    if (!handled) target.dispatch(target.state.tr.insertText(char, from, to))
  }
}

function press(target: EditorView, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  return !!target.someProp('handleKeyDown', (handler) => handler(target, event))
}

describe('mention', () => {
  it('opens on @ and tracks the query, but not inside a word or an email', () => {
    const target = create('Hi ')
    type(target, '@戴')
    expect(getMention(target.state)).toMatchObject({ query: '戴' })
    type(target, ' ')
    expect(getMention(target.state)).toBeNull()
    type(target, 'me@x')
    expect(getMention(target.state)).toBeNull()
  })

  it('picks with the keyboard and stores id and label', () => {
    const target = create('Hi ')
    type(target, '@')
    setMentionItems(target, people)
    expect(press(target, 'ArrowDown')).toBe(true)
    expect(press(target, 'Enter')).toBe(true)
    expect(getMention(target.state)).toBeNull()
    expect(docToBlocks(target.state.doc)[0]!.content).toEqual([
      { type: 'text', text: 'Hi ' },
      { type: 'inline', name: 'mention', props: { id: 'u2', label: '阿青' } },
      { type: 'text', text: ' ' },
    ])
    expect(target.dom.querySelector('.dou-editor__mention')!.textContent).toBe('@阿青')
  })

  it('closes on Escape and leaves the text', () => {
    const target = create()
    type(target, '@a')
    expect(press(target, 'Escape')).toBe(true)
    expect(getMention(target.state)).toBeNull()
    expect(target.state.doc.textContent).toBe('@a')
  })

  it('round-trips through blocks and pasted HTML', () => {
    const { schema } = resolveEditorExtensions([editorKit(), mention({ search })])
    const blocks = docToBlocks(
      blocksToDoc(schema, [
        { content: [{ type: 'inline', name: 'mention', props: { id: 'u1', label: '戴兜' } }] },
      ]),
    )
    expect(blocks[0]!.content).toEqual([
      { type: 'inline', name: 'mention', props: { id: 'u1', label: '戴兜' } },
    ])
    const element = document.createElement('div')
    element.innerHTML = '<p>cc <span data-mention="u2">@阿青</span></p>'
    expect(docToBlocks(DOMParser.fromSchema(schema).parse(element))[0]!.content[1]).toEqual({
      type: 'inline',
      name: 'mention',
      props: { id: 'u2', label: '阿青' },
    })
  })

  it('leaves out mentions when the extension is missing', () => {
    const { schema } = resolveEditorExtensions([editorKit()])
    const blocks = docToBlocks(
      blocksToDoc(schema, [
        {
          content: [
            { type: 'text', text: 'a' },
            { type: 'inline', name: 'mention', props: { id: 'u1', label: 'x' } },
          ],
        },
      ]),
    )
    expect(blocks[0]!.content).toEqual([{ type: 'text', text: 'a' }])
  })
})

describe('mention suggestions', () => {
  it('lists the latest results and inserts the one clicked', async () => {
    const pending: ((items: MentionItem[]) => void)[] = []
    const wrapper = mount(DouEditor, {
      attachTo: document.body,
      props: {
        extensions: [
          editorKit(),
          mention({ search: () => new Promise<MentionItem[]>((resolve) => pending.push(resolve)) }),
        ],
        modelValue: [{ id: 'a', content: '' }],
      },
    })
    await nextTick()
    const target = (wrapper.vm as unknown as { view: EditorView }).view
    type(target, '@')
    await nextTick()
    type(target, '戴')
    await nextTick()
    // the second search answers first; the first one is late and ignored
    pending[1]!([people[0]!])
    await flush()
    pending[0]!(people)
    await flush()
    await nextTick()
    const items = document.querySelectorAll<HTMLElement>('.dou-editor-mention__item')
    expect([...items].map((item) => item.textContent)).toEqual([expect.stringContaining('戴兜')])
    items[0]!.click()
    await nextTick()
    const blocks = wrapper.emitted('update:modelValue')!.at(-1)![0] as Block[]
    expect(blocks[0]!.content[0]).toEqual({
      type: 'inline',
      name: 'mention',
      props: { id: 'u1', label: '戴兜' },
    })
    expect(document.querySelector('.dou-editor-mention__item')).toBeNull()
    wrapper.unmount()
  })
})
