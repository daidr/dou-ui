import { mount } from '@vue/test-utils'
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { blocksToHTML } from '../../core/convert'
import { findBlockById } from '../../core/blocks'
import type { Block, PartialBlock } from '../../core/model'
import DouEditor from '../../editor.vue'
import type { EditorExpose } from '../../editor'
import { editorKit } from '../../extensions/editor-kit'
import { codeEditorBlock, codeEditorLanguages, findCodeLanguage } from '../index'

const wrappers: { unmount(): void }[] = []
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
})

const START: PartialBlock[] = [
  { id: 'p', type: 'paragraph', content: '前面' },
  {
    id: 'c',
    type: 'codeBlock',
    props: { language: 'bash' },
    content: 'echo 1',
  },
  { id: 'q', type: 'paragraph', content: '后面' },
]

async function open(blocks = START, readonly = false) {
  const value = ref<Block[] | PartialBlock[]>(blocks)
  const editor = ref<EditorExpose>()
  const extensions = [editorKit({ codeBlock: codeEditorBlock() })]
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouEditor, {
          ref: editor,
          modelValue: value.value as PartialBlock[],
          'onUpdate:modelValue': (next: Block[]) => (value.value = next),
          extensions,
          readonly,
        }),
    ),
    { attachTo: document.body },
  )
  wrappers.push(wrapper)
  await nextTick()
  const view = editor.value!.view as EditorView
  const input = () =>
    wrapper.element.querySelector('.dou-editor-code-editor textarea') as HTMLTextAreaElement
  const code = () => findBlockById(view.state.doc, 'c')?.content.textContent
  const type = async (text: string) => {
    const el = input()
    el.focus()
    const start = el.selectionStart
    el.value = el.value.slice(0, start) + text + el.value.slice(el.selectionEnd)
    el.setSelectionRange(start + text.length, start + text.length)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
  }
  const press = async (key: string, init: KeyboardEventInit = {}) => {
    input().dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    )
    await nextTick()
  }
  return { wrapper, value, view, input, code, type, press }
}

describe('codeEditorBlock', () => {
  it('edits the block in the code editor, and the language by alias', async () => {
    const { wrapper } = await open()
    const block = wrapper.find('.dou-editor-code-editor')
    expect(block.exists()).toBe(true)
    expect(block.find('.dou-code-editor').exists()).toBe(true)
    // `bash` is one of Shell's aliases: the picker shows it as Shell
    expect(block.find('.dou-editor-code__language').text()).toBe('Shell')
    expect(block.find('.dou-code-editor').text()).toContain('echo 1')
  })

  it('sends typing into the document, with the cursor', async () => {
    const { view, code, type, value, input } = await open()
    input().focus()
    input().setSelectionRange(6, 6)
    input().dispatchEvent(new Event('select'))
    await type(' && echo 2')
    expect(code()).toBe('echo 1 && echo 2')
    const block = (value.value as Block[]).find((b) => b.id === 'c')!
    expect(block.content).toEqual([{ type: 'text', text: 'echo 1 && echo 2' }])
    // the document's cursor is in the block too
    const info = findBlockById(view.state.doc, 'c')!
    const { from } = view.state.selection
    expect(from).toBeGreaterThan(info.contentPos)
    expect(from).toBeLessThan(info.contentPos + info.content.nodeSize)
  })

  it('shows changes made to the document elsewhere', async () => {
    const { view, wrapper } = await open()
    const info = findBlockById(view.state.doc, 'c')!
    view.dispatch(view.state.tr.insertText('ls; ', info.contentPos + 1))
    await nextTick()
    expect(wrapper.find('.dou-code-editor').text()).toContain('ls; echo 1')
  })

  it('undoes with the document', async () => {
    const { code, type, press } = await open()
    await type('x')
    expect(code()).toBe('xecho 1')
    await press('z', { ctrlKey: true })
    expect(code()).toBe('echo 1')
    await press('z', { ctrlKey: true, shiftKey: true })
    expect(code()).toBe('xecho 1')
  })

  it('leaves the block with the arrows at its edges', async () => {
    const { view, input, press } = await open()
    input().focus()
    await press('ArrowUp')
    const before = findBlockById(view.state.doc, 'p')!
    expect(view.state.selection.from).toBeLessThan(before.pos + before.node.nodeSize)
    const caretAfter = () => {
      const after = findBlockById(view.state.doc, 'q')!
      return view.state.selection.from > after.pos
    }
    input().focus()
    input().setSelectionRange(6, 6)
    input().dispatchEvent(new Event('select'))
    await press('ArrowDown')
    expect(caretAfter()).toBe(true)
  })

  it('puts the cursor in the code when the document moves it there', async () => {
    const { view, input } = await open()
    view.focus()
    const info = findBlockById(view.state.doc, 'c')!
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, info.contentPos + 3)),
    )
    await nextTick()
    expect(document.activeElement).toBe(input())
  })

  it('turns an empty block into a paragraph with Backspace', async () => {
    const { view, press } = await open([{ id: 'c', type: 'codeBlock', content: '' }])
    await press('Backspace')
    expect(findBlockById(view.state.doc, 'c')!.content.type.name).toBe('paragraph')
  })

  it('writes the same HTML and Markdown as the built-in code block', () => {
    const blocks: PartialBlock[] = [
      { type: 'codeBlock', props: { language: 'js' }, content: 'a<b' },
    ]
    expect(blocksToHTML(blocks, [editorKit({ codeBlock: codeEditorBlock() })])).toBe(
      blocksToHTML(blocks, [editorKit()]),
    )
  })

  it('is read-only with the editor', async () => {
    const { wrapper } = await open(START, true)
    expect(wrapper.find('.dou-editor-code__language.is-static').text()).toBe('Shell')
    expect(wrapper.find('.dou-code-editor').classes()).toContain('is-readonly')
  })

  it('finds languages by name, then alias', () => {
    expect(findCodeLanguage(codeEditorLanguages, 'yml')?.label).toBe('YAML')
    expect(findCodeLanguage(codeEditorLanguages, 'TypeScript')?.label).toBe('TypeScript')
    expect(findCodeLanguage(codeEditorLanguages, 'rust')).toBeNull()
  })
})
