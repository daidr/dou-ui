import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { CodeText } from '../core/text'
import { typeText } from '../core/commands'
import {
  DouCodeEditor,
  DouCodeKeys,
  type CodeEditorExpose,
  defaultCodeKeys,
  typescript,
} from '../index'

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
            // Measured boxes in the frame: the test page has no layout to place them above.
            teleport: false,
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

  it('takes a tap on the caret handle over the next line as a tap on that line', async () => {
    const { wrapper, tap, range, handles, menu } = setup()
    await tap(at(6, 0))
    expect(handles()).toEqual(['is-caret'])
    const handle = wrapper.find('.dou-code-editor__handle.is-caret')
    const below = at(4, 1)
    await handle.trigger('pointerdown', { pointerType: 'touch', pointerId: 1, button: 0, ...below })
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, ...below }))
    await nextTick()
    expect(range()).toEqual({ anchor: 20, head: 20 })
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

/** Makes the browser report a touch screen, as a phone does. */
function stubCoarsePointer() {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('coarse'),
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList,
  )
}

/** Whether a finger moving on the page now is kept from scrolling it. */
function move() {
  const event = new Event('touchmove', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

/** A long press on a word, which selects it, then the finger lifts. */
async function selectWord(content: { trigger: (type: string, init?: object) => Promise<void> }) {
  vi.useFakeTimers()
  await content.trigger('pointerdown', {
    pointerType: 'touch',
    pointerId: 1,
    button: 0,
    ...at(7, 0),
  })
  vi.advanceTimersByTime(500)
  vi.useRealTimers()
  await nextTick()
}

/** A view of the page that a test can shrink, the way a keyboard and the browser's bars do. */
function stubViewport(height: number) {
  const view = Object.assign(new EventTarget(), {
    offsetTop: 0,
    offsetLeft: 0,
    pageTop: 0,
    pageLeft: 0,
    width: 390,
    height,
    scale: 1,
  })
  vi.stubGlobal('visualViewport', view)
  vi.stubGlobal('innerHeight', 800)
  return (next: number, scale = 1) => {
    view.height = next
    view.scale = scale
    view.dispatchEvent(new Event('resize'))
  }
}

/** The layer above the page, with the handles in it. */
function layer() {
  return document.querySelector('.dou-code-editor__floating.is-outside')!
}

/** Whether the bar of keys above the page is faded out for a page scroll. */
function keysScrolling() {
  return document.querySelector('.dou-code-editor__keys')!.classList.contains('is-scrolling')
}

describe('touch on a phone', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('follows the keyboard as it comes up or grows, not while a finger scrolls the page and its bars resize the view', async () => {
    stubCoarsePointer()
    const resize = stubViewport(800)
    const scrollBy = vi.fn<(x: number, y: number) => void>()
    vi.stubGlobal('scrollBy', scrollBy)
    const { tap } = setup()
    await nextTick()
    await tap(at(6, 1))
    await nextTick()
    resize(100)
    expect(scrollBy).toHaveBeenCalled()
    scrollBy.mockClear()
    // A row of candidates over the keyboard, a little taller.
    resize(60)
    expect(scrollBy).toHaveBeenCalled()
    scrollBy.mockClear()
    // The browser's own bar grows back while a finger scrolls the page.
    window.dispatchEvent(new Event('touchmove'))
    resize(20)
    expect(scrollBy).not.toHaveBeenCalled()
  })

  it('takes zooming in for no keyboard', async () => {
    stubCoarsePointer()
    const resize = stubViewport(800)
    const scrollBy = vi.fn<(x: number, y: number) => void>()
    vi.stubGlobal('scrollBy', scrollBy)
    const { tap } = setup()
    await nextTick()
    await tap(at(6, 1))
    await nextTick()
    resize(400, 2)
    expect(scrollBy).not.toHaveBeenCalled()
  })

  it("keeps the bar of keys in place for the editor's own scroll to the cursor", async () => {
    stubCoarsePointer()
    const resize = stubViewport(800)
    vi.stubGlobal('scrollBy', () => window.dispatchEvent(new Event('scroll')))
    const { tap } = setup()
    await nextTick()
    await tap(at(6, 1))
    await nextTick()
    resize(60)
    await nextTick()
    expect(keysScrolling()).toBe(false)
  })

  it('fades the bar of keys out while the page scrolls', async () => {
    vi.useFakeTimers()
    stubCoarsePointer()
    stubViewport(400)
    const { tap } = setup()
    await nextTick()
    await tap(at(6, 0))
    await nextTick()
    expect(keysScrolling()).toBe(false)
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(keysScrolling()).toBe(true)
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(keysScrolling()).toBe(false)
  })

  it("keeps only a caret in the textarea, so the system's own selection never shows; typing replaces the selection", async () => {
    stubCoarsePointer()
    const { wrapper, code, range } = setup()
    await nextTick()
    await selectWord(wrapper.find('.dou-code-editor__content'))
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }))
    await nextTick()
    expect(range()).toEqual({ anchor: 6, head: 11 })
    const textarea = wrapper.find('textarea').element
    expect(textarea.selectionStart).toBe(textarea.selectionEnd)
    expect(textarea.selectionEnd).toBe(11)
    // A character typed at the caret takes the selection's place.
    const value = textarea.value
    textarea.value = `${value.slice(0, 11)}x${value.slice(11)}`
    textarea.dispatchEvent(new Event('input'))
    await nextTick()
    expect(code.value.split('\n')[0]).toBe('const x = [')
    expect(range()).toEqual({ anchor: 7, head: 7 })
  })

  it('deletes the selection on a backspace at the caret that stands for it', async () => {
    stubCoarsePointer()
    const { wrapper, code } = setup()
    await nextTick()
    await selectWord(wrapper.find('.dou-code-editor__content'))
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }))
    await nextTick()
    const textarea = wrapper.find('textarea').element
    const value = textarea.value
    textarea.value = value.slice(0, 10) + value.slice(11)
    textarea.dispatchEvent(new Event('input'))
    await nextTick()
    expect(code.value.split('\n')[0]).toBe('const  = [')
  })

  it('ends a drag whose finger lifted unheard, so the page scrolls again', async () => {
    const { wrapper } = setup()
    await nextTick()
    await selectWord(wrapper.find('.dou-code-editor__content'))
    expect(wrapper.find('.dou-code-editor__magnifier').exists()).toBe(true)
    expect(move()).toBe(true)
    // The pointerup never comes (Safari sent it to a removed line); the touch still ends.
    window.dispatchEvent(new Event('touchend'))
    await new Promise((resolve) => setTimeout(resolve))
    await nextTick()
    expect(move()).toBe(false)
    expect(wrapper.find('.dou-code-editor__magnifier').exists()).toBe(false)
  })

  it('ends any press when the editor loses focus', async () => {
    const { wrapper } = setup()
    await nextTick()
    await selectWord(wrapper.find('.dou-code-editor__content'))
    wrapper.find('textarea').element.dispatchEvent(new FocusEvent('blur'))
    const event = new Event('touchmove', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  it('hides the handles above the page while a box around the editor scrolls, until it stops', async () => {
    vi.useFakeTimers()
    const size = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200)
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300)
    const wrapper = mount(
      defineComponent(
        () => () =>
          h('div', { class: 'panel' }, [h(DouCodeEditor, { modelValue: source, keys: false })]),
      ),
      { attachTo: document.body },
    )
    await nextTick()
    const content = wrapper.find('.dou-code-editor__content')
    const point = { pointerType: 'touch', pointerId: 1, button: 0, ...at(6, 0) }
    await content.trigger('pointerdown', point)
    await content.trigger('pointerup', point)
    await nextTick()
    expect(layer().classList.contains('is-scrolling')).toBe(false)
    wrapper.find('.panel').element.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(layer().classList.contains('is-scrolling')).toBe(true)
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(layer().classList.contains('is-scrolling')).toBe(false)
    // The page itself carries the layer along: nothing to hide.
    document.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(layer().classList.contains('is-scrolling')).toBe(false)
    wrapper.unmount()
    size.mockRestore()
    width.mockRestore()
  })

  it('keeps the layer fixed for an editor in a fixed box, and hides it while the page scrolls one in a sticky box', async () => {
    vi.useFakeTimers()
    const size = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200)
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300)
    for (const position of ['fixed', 'sticky']) {
      const wrapper = mount(
        defineComponent(
          () => () =>
            h('div', { style: { position } }, [
              h(DouCodeEditor, { modelValue: source, keys: false }),
            ]),
        ),
        { attachTo: document.body },
      )
      await nextTick()
      const content = wrapper.find('.dou-code-editor__content')
      const point = { pointerType: 'touch', pointerId: 1, button: 0, ...at(6, 0) }
      await content.trigger('pointerdown', point)
      await content.trigger('pointerup', point)
      await nextTick()
      expect(layer().classList.contains('is-fixed')).toBe(position === 'fixed')
      document.dispatchEvent(new Event('scroll'))
      await nextTick()
      expect(layer().classList.contains('is-scrolling')).toBe(position === 'sticky')
      vi.advanceTimersByTime(200)
      wrapper.unmount()
    }
    size.mockRestore()
    width.mockRestore()
  })

  it('draws the handles above the page by default, so a one-line box never cuts them off', async () => {
    // A frame with room, for the handles to be in view.
    const size = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200)
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300)
    const wrapper = mount(
      defineComponent(() => () => h(DouCodeEditor, { modelValue: source, keys: false })),
      { attachTo: document.body },
    )
    await nextTick()
    const content = wrapper.find('.dou-code-editor__content')
    await content.trigger('pointerdown', {
      pointerType: 'touch',
      pointerId: 1,
      button: 0,
      ...at(6, 0),
    })
    await content.trigger('pointerup', {
      pointerType: 'touch',
      pointerId: 1,
      button: 0,
      ...at(6, 0),
    })
    await nextTick()
    const handle = document.querySelector('.dou-code-editor__handle')
    expect(handle).not.toBeNull()
    expect(wrapper.element.contains(handle)).toBe(false)
    expect(handle!.closest('.dou-code-editor__floating.is-outside')).not.toBeNull()
    wrapper.unmount()
    size.mockRestore()
    width.mockRestore()
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

  it("adds to the default keys, which read out in the bar's language", async () => {
    const editor = ref<CodeEditorExpose>()
    const wrapper = mount(
      defineComponent(
        () => () =>
          h('div', [
            h(DouCodeEditor, { ref: editor, doc: CodeText.of('') }),
            h(DouCodeKeys, {
              editor: editor.value,
              keys: [...defaultCodeKeys, { label: '=>', text: ' => ' }],
            }),
          ]),
      ),
    )
    await nextTick()
    const keys = wrapper.findAll('.dou-code-keys__scroll .dou-code-keys__key')
    expect(keys.length).toBe(defaultCodeKeys.length + 1)
    expect(keys[0]!.attributes('aria-label')).toBe('缩进')
    expect(wrapper.find('[aria-label="撤销"]').exists()).toBe(true)
    await press(keys[keys.length - 1]!)
    expect(editor.value!.doc.toString()).toBe(' => ')
  })
})
