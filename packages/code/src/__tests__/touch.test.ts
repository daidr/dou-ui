import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { CodeText } from '../core/text'
import { typeText } from '../core/commands'
import { DouCodeEditor, DouCodeKeys, type CodeEditorExpose, typescript } from '../index'

/** Without a page to measure in, cells are 8px wide and lines 20px high, inside 12px and 8px of padding. */
const at = (col: number, line: number) => ({
  clientX: 12 + col * 8 + 2,
  clientY: 8 + line * 20 + 10,
})

const source = ['const todos = [', "  { title: '给阿青回消息' },", ']'].join('\n')

function setup(initial = source) {
  const code = ref(initial)
  const editor = ref<CodeEditorExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h('div', [
          h(DouCodeEditor, {
            ref: editor,
            modelValue: code.value,
            'onUpdate:modelValue': (value: string) => (code.value = value),
            language: typescript,
          }),
          h(DouCodeKeys, { editor: editor.value }),
        ]),
    ),
    { attachTo: document.body },
  )
  const content = wrapper.find('.dou-code-editor__content')
  const touch = async (
    type: string,
    point: { clientX: number; clientY: number },
    target = content,
  ) => {
    await target.trigger(type, { pointerType: 'touch', pointerId: 1, button: 0, ...point })
  }
  const tap = async (point: { clientX: number; clientY: number }) => {
    await touch('pointerdown', point)
    await touch('pointerup', point)
    await nextTick()
  }
  const range = () => editor.value!.selection.ranges[editor.value!.selection.main]!
  const handles = () =>
    wrapper
      .findAll('.dou-code-editor__handle')
      .map((el) => el.classes().find((c) => c.startsWith('is-')))
  const menu = () => wrapper.findAll('.dou-code-editor__menu-button').map((el) => el.text())
  return { wrapper, code, editor, touch, tap, range, handles, menu }
}

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('touch', () => {
  it('puts a handle under the cursor on a tap, and the toolbar on a second tap there', async () => {
    const { tap, range, handles, menu } = setup()
    await tap(at(6, 0))
    expect(range()).toEqual({ anchor: 6, head: 6 })
    expect(handles()).toEqual(['is-caret'])
    expect(menu()).toEqual([])
    await tap(at(6, 0))
    expect(menu()).toContain('全选')
    expect(menu()).not.toContain('复制')
    await tap(at(6, 0))
    expect(menu()).toEqual([])
  })

  it('selects a word on a long press and grows it word by word, then offers the toolbar', async () => {
    vi.useFakeTimers()
    const { wrapper, touch, range, handles, menu } = setup()
    await touch('pointerdown', at(7, 0))
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(range()).toEqual({ anchor: 6, head: 11 })
    expect(handles()).toEqual(['is-start', 'is-end'])
    expect(wrapper.find('.dou-code-editor__magnifier').exists()).toBe(true)
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, ...at(13, 0) }))
    await nextTick()
    // On past "todos", word by word.
    expect(range().anchor).toBe(6)
    expect(range().head).toBeGreaterThan(12)
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, ...at(13, 0) }))
    await nextTick()
    await nextTick()
    expect(wrapper.find('.dou-code-editor__magnifier').exists()).toBe(false)
    expect(menu()).toEqual(expect.arrayContaining(['剪切', '复制', '全选']))
  })

  it('scrolls instead of selecting when the finger moves before the long press', async () => {
    vi.useFakeTimers()
    const { touch, range } = setup()
    await touch('pointerdown', at(7, 0))
    await touch('pointermove', { clientX: at(7, 0).clientX, clientY: 0 })
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(range()).toEqual({ anchor: 0, head: 0 })
  })

  it('moves an end of the selection by its handle, keeping a character selected', async () => {
    const { wrapper, editor, range, handles } = setup()
    editor.value!.focus()
    await nextTick()
    // A selection made by finger, to have handles.
    vi.useFakeTimers()
    const content = wrapper.find('.dou-code-editor__content')
    await content.trigger('pointerdown', {
      pointerType: 'touch',
      pointerId: 1,
      button: 0,
      ...at(7, 0),
    })
    vi.advanceTimersByTime(500)
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }))
    vi.useRealTimers()
    await nextTick()
    expect(handles()).toEqual(['is-start', 'is-end'])
    const end = wrapper.find('.dou-code-editor__handle.is-end')
    // The handle sits below the line; the finger drags it a line down.
    await end.trigger('pointerdown', {
      pointerType: 'touch',
      pointerId: 2,
      button: 0,
      clientX: 12 + 11 * 8,
      clientY: 8 + 20 + 10,
    })
    window.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 2, clientX: 12 + 4 * 8, clientY: 8 + 40 + 10 }),
    )
    await nextTick()
    expect(range()).toEqual({ anchor: 6, head: 16 + 4 })
    // Dragged past the start, it never leaves the selection empty.
    window.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 2, clientX: 12 + 6 * 8, clientY: 8 + 20 + 10 }),
    )
    await nextTick()
    expect(range().head).not.toBe(6)
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2 }))
    await nextTick()
    await nextTick()
    expect(wrapper.findAll('.dou-code-editor__menu-button').length).toBeGreaterThan(0)
  })

  it('puts the toolbar away on Escape, on typing and on blur, and selects all from it', async () => {
    const { wrapper, editor, tap, menu, range } = setup()
    await tap(at(6, 0))
    await tap(at(6, 0))
    expect(menu()).toContain('全选')
    const textarea = wrapper.find('textarea')
    await textarea.trigger('keydown', { key: 'Escape' })
    expect(menu()).toEqual([])
    await tap(at(6, 0))
    const all = wrapper.findAll('.dou-code-editor__menu-button').find((el) => el.text() === '全选')!
    await all.trigger('click')
    expect(range()).toEqual({ anchor: 0, head: source.length })
    // Still open over the new selection, now with copy.
    expect(menu()).toContain('复制')
    editor.value!.run(typeText('x'))
    await nextTick()
    expect(menu()).toEqual([])
    await tap(at(0, 0))
    await tap(at(0, 0))
    expect(menu().length).toBeGreaterThan(0)
    textarea.element.dispatchEvent(new FocusEvent('blur'))
    await nextTick()
    expect(menu()).toEqual([])
  })
})

const press = async (key: { trigger: (type: string, init?: object) => Promise<void> }) => {
  await key.trigger('pointerdown', { pointerType: 'touch', pointerId: 3, button: 0 })
  await key.trigger('pointerup', { pointerId: 3 })
}

describe('DouCodeKeys', () => {
  it('types through the editor, so brackets close themselves', async () => {
    const { wrapper, editor, code } = setup('')
    await nextTick()
    const keys = wrapper.findAll('.dou-code-keys__key')
    await press(keys.find((k) => k.text() === '(')!)
    expect(code.value).toBe('()')
    expect(editor.value!.selection.ranges[0]!.head).toBe(1)
    await press(keys.find((k) => k.text() === 'Tab')!)
    // To the next tab stop, which is one column away.
    expect(code.value).toBe('( )')
  })

  it('repeats the arrow keys while held, and leaves a slide to the scrolling', async () => {
    vi.useFakeTimers()
    const { wrapper, editor, code } = setup('abcdefgh')
    await nextTick()
    editor.value!.select(8)
    const left = wrapper.find('.dou-code-keys__arrows .dou-code-keys__key')
    await left.trigger('pointerdown', { pointerType: 'touch', pointerId: 4, button: 0 })
    vi.advanceTimersByTime(400 + 60 * 3)
    await left.trigger('pointerup', { pointerId: 4 })
    expect(editor.value!.selection.ranges[0]!.head).toBe(4)
    // A finger that slides off is scrolling the bar: nothing is typed.
    const key = wrapper.findAll('.dou-code-keys__key').find((k) => k.text() === ';')!
    await key.trigger('pointerdown', {
      pointerType: 'touch',
      pointerId: 5,
      button: 0,
      clientX: 0,
      clientY: 0,
    })
    await key.trigger('pointermove', { pointerId: 5, clientX: 30, clientY: 0 })
    await key.trigger('pointerup', { pointerId: 5, clientX: 30, clientY: 0 })
    expect(code.value).toBe('abcdefgh')
  })

  it('types text keys given as strings', async () => {
    const editor = ref<CodeEditorExpose>()
    const wrapper = mount(
      defineComponent(
        () => () =>
          h('div', [
            h(DouCodeEditor, { ref: editor, doc: CodeText.of('') }),
            h(DouCodeKeys, { editor: editor.value, keys: ['=>', { label: '//', text: '// ' }] }),
          ]),
      ),
    )
    await nextTick()
    const keys = wrapper.findAll('.dou-code-keys__scroll .dou-code-keys__key')
    expect(keys.map((k) => k.text())).toEqual(['=>', '//'])
    await press(keys[0]!)
    await press(keys[1]!)
    expect(editor.value!.doc.toString()).toBe('=>// ')
  })
})
