import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  CodeText,
  DouCodeEditor,
  javascript,
  type CodeEditorExpose,
  type CodeSelection,
} from '../index'

function setup(initial = 'const a = 1\nconst b = 2', extra: Record<string, unknown> = {}) {
  const code = ref(initial)
  const selection = ref<CodeSelection | undefined>()
  const editor = ref<CodeEditorExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouCodeEditor, {
          ref: editor,
          modelValue: code.value,
          'onUpdate:modelValue': (value: string) => (code.value = value),
          selection: selection.value,
          'onUpdate:selection': (value: CodeSelection) => (selection.value = value),
          ...extra,
        }),
    ),
    { attachTo: document.body },
  )
  const input = wrapper.find('textarea').element as HTMLTextAreaElement
  input.focus()
  const key = async (name: string, init: KeyboardEventInit = {}) => {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }),
    )
    await nextTick()
  }
  /** Types the way a browser does: the textarea's text changes, then `input` fires. */
  const type = async (text: string) => {
    const start = input.selectionStart
    input.value = input.value.slice(0, start) + text + input.value.slice(input.selectionEnd)
    input.setSelectionRange(start + text.length, start + text.length)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
  }
  const head = () => editor.value!.selection.ranges[editor.value!.selection.main]!.head
  return { wrapper, code, selection, editor, input, key, type, head }
}

describe('DouCodeEditor', () => {
  it('draws the lines with numbers', () => {
    const { wrapper } = setup()
    expect(wrapper.findAll('.dou-code-editor__line').map((line) => line.text())).toEqual([
      'const a = 1',
      'const b = 2',
    ])
    expect(wrapper.findAll('.dou-code-editor__number').map((n) => n.text())).toEqual(['1', '2'])
  })

  it('types at the cursor and hands the code back', async () => {
    const { type, code, editor, key } = setup()
    editor.value!.select(5)
    await nextTick()
    await type('X')
    expect(code.value).toBe('constX a = 1\nconst b = 2')
    await key('Enter')
    expect(code.value).toBe('constX\n a = 1\nconst b = 2')
    await key('Backspace')
    await key('Backspace')
    expect(code.value).toBe('const a = 1\nconst b = 2')
  })

  it('keeps the indentation on Enter', async () => {
    const { editor, key, code } = setup('  foo')
    editor.value!.select(5)
    await key('Enter')
    expect(code.value).toBe('  foo\n  ')
  })

  it('moves the cursor with keys', async () => {
    const { editor, key, head } = setup('one two\nthree')
    editor.value!.select(0)
    await key('ArrowRight')
    expect(head()).toBe(1)
    await key('ArrowRight', { ctrlKey: true })
    expect(head()).toBe(3)
    await key('End')
    expect(head()).toBe(7)
    await key('ArrowDown')
    expect(head()).toBe(13)
    await key('ArrowLeft', { shiftKey: true })
    const range = editor.value!.selection.ranges[0]!
    expect(range).toEqual({ anchor: 13, head: 12 })
    await key('Home')
    expect(head()).toBe(8)
  })

  it('keeps the column when moving through a short line', async () => {
    const { editor, key, head } = setup('abcdefgh\nab\nabcdefgh')
    editor.value!.select(6)
    await key('ArrowDown')
    expect(head()).toBe(11)
    await key('ArrowDown')
    expect(head()).toBe(18)
  })

  it('undoes typing as one step and redoes it', async () => {
    const { editor, type, code, key } = setup('x')
    editor.value!.select(1)
    await type('a')
    await type('b')
    await type('c')
    expect(code.value).toBe('xabc')
    await key('z', { ctrlKey: true })
    expect(code.value).toBe('x')
    expect(editor.value!.selection.ranges[0]!.head).toBe(1)
    await key('z', { ctrlKey: true, shiftKey: true })
    expect(code.value).toBe('xabc')
  })

  it('types into every cursor', async () => {
    const { editor, type, code } = setup('a\nb\nc')
    editor.value!.select({
      ranges: [
        { anchor: 1, head: 1 },
        { anchor: 3, head: 3 },
        { anchor: 5, head: 5 },
      ],
      main: 0,
    })
    await nextTick()
    await type(';')
    expect(code.value).toBe('a;\nb;\nc;')
  })

  it('shows the composition in place and applies it once confirmed', async () => {
    const { wrapper, editor, input, code } = setup('ab')
    editor.value!.select(1)
    await nextTick()
    input.dispatchEvent(new CompositionEvent('compositionstart'))
    input.value = 'anib'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(wrapper.find('.dou-code-editor__compose').text()).toBe('ni')
    expect(code.value).toBe('ab')
    // Keys go to the input method while it composes.
    await input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, cancelable: true }),
    )
    expect(code.value).toBe('ab')
    input.value = 'a你b'
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new CompositionEvent('compositionend', { data: '你' }))
    await nextTick()
    expect(code.value).toBe('a你b')
    expect(wrapper.find('.dou-code-editor__compose').exists()).toBe(false)
  })

  it('drops the line break of the Enter that confirmed a composition', async () => {
    const { editor, input, code, key, type } = setup('ab')
    editor.value!.select(1)
    await nextTick()
    input.dispatchEvent(new CompositionEvent('compositionstart'))
    input.value = 'anib'
    input.dispatchEvent(new Event('input'))
    await key('Enter', { isComposing: true })
    input.value = 'a你b'
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new CompositionEvent('compositionend', { data: '你' }))
    await nextTick()
    // Some browsers put the confirming Enter's line break into the textarea as well.
    await type('\n')
    expect(code.value).toBe('a你b')
    // A later Enter is a line break again.
    await key('Enter')
    expect(code.value).toBe('a你\nb')
  })

  it('deletes with a textarea change, as phone keyboards do', async () => {
    const { editor, input, code } = setup('abc')
    editor.value!.select(3)
    await nextTick()
    input.value = 'ab'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(code.value).toBe('ab')
  })

  it('takes in a new value as a change that keeps the cursor', async () => {
    const { editor, code } = setup('hello world')
    editor.value!.select(11)
    code.value = '>> hello world'
    await nextTick()
    expect(editor.value!.selection.ranges[0]!.head).toBe(14)
    expect(editor.value!.canUndo).toBe(true)
  })

  it('pastes one line per cursor when the counts match', async () => {
    const { editor, input, code } = setup('a\nb')
    editor.value!.select({
      ranges: [
        { anchor: 1, head: 1 },
        { anchor: 3, head: 3 },
      ],
      main: 0,
    })
    const event = new Event('paste', { cancelable: true }) as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => '1\n2' } })
    input.dispatchEvent(event)
    await nextTick()
    expect(code.value).toBe('a1\nb2')
  })

  it('copies every selected range', () => {
    const { editor, input } = setup('alpha beta')
    editor.value!.select({
      ranges: [
        { anchor: 0, head: 5 },
        { anchor: 6, head: 10 },
      ],
      main: 0,
    })
    let copied = ''
    const event = new Event('copy', { cancelable: true }) as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', {
      value: { setData: (_: string, text: string) => (copied = text) },
    })
    input.dispatchEvent(event)
    expect(copied).toBe('alpha\nbeta')
  })

  it('does not change a read-only text', async () => {
    const { editor, type, key, code } = setup('abc', { readonly: true })
    editor.value!.select(3)
    await type('x')
    await key('Backspace')
    expect(code.value).toBe('abc')
    await key('ArrowLeft')
    expect(editor.value!.selection.ranges[0]!.head).toBe(2)
  })

  it('lets Tab leave the editor after Escape', async () => {
    const { key, code, editor } = setup('a')
    editor.value!.select(1)
    await key('Tab')
    expect(code.value).toBe('a ')
    await key('Escape')
    await key('Tab')
    expect(code.value).toBe('a ')
  })

  it('hands the code back on blur with v-model.lazy', async () => {
    const { type, code, input, editor } = setup('a', { modelModifiers: { lazy: true } })
    editor.value!.select(1)
    await type('b')
    expect(code.value).toBe('a')
    input.dispatchEvent(new FocusEvent('blur'))
    expect(code.value).toBe('ab')
  })

  it('works with v-model:doc alone', async () => {
    const doc = ref(CodeText.of('x'))
    const editor = ref<CodeEditorExpose>()
    mount(
      defineComponent(
        () => () =>
          h(DouCodeEditor, {
            ref: editor,
            doc: doc.value,
            'onUpdate:doc': (value: CodeText) => (doc.value = value),
          }),
      ),
    )
    expect(editor.value!.transact((tr) => tr.insert(1, 'yz')).changed).toBe(true)
    await nextTick()
    expect(doc.value.toString()).toBe('xyz')
    // nothing to do: the result says so, and nothing is applied
    const idle = editor.value!.transact(() => {})
    expect(idle.changed).toBe(false)
    expect(idle.state.doc).toBe(idle.before.doc)
    doc.value = CodeText.of('new')
    await nextTick()
    expect(editor.value!.doc).toBe(doc.value)
  })

  it('draws only the lines in view of a long text', () => {
    const long = Array.from({ length: 50_000 }, (_, i) => `line ${i}`).join('\n')
    const { wrapper } = setup(long, { style: 'height: 400px' })
    expect(wrapper.findAll('.dou-code-editor__line').length).toBeLessThan(200)
  })
})

/** Gives every element a size, as jsdom lays nothing out. */
function sized(width: number, height: number) {
  const proto = HTMLElement.prototype
  const saved = {
    w: Object.getOwnPropertyDescriptor(proto, 'clientWidth')!,
    h: Object.getOwnPropertyDescriptor(proto, 'clientHeight')!,
  }
  Object.defineProperty(proto, 'clientWidth', { configurable: true, get: () => width })
  Object.defineProperty(proto, 'clientHeight', { configurable: true, get: () => height })
  return () => {
    Object.defineProperty(proto, 'clientWidth', saved.w)
    Object.defineProperty(proto, 'clientHeight', saved.h)
  }
}

describe('minimap', () => {
  const text = Array.from({ length: 1000 }, (_, i) => `line ${i}`).join('\n')

  it('shows the text in small beside it, and goes where it is pressed', async () => {
    const restore = sized(800, 400)
    try {
      const { wrapper } = setup(text, { minimap: true })
      await nextTick()
      await nextTick()
      const map = wrapper.find('.dou-code-editor__minimap')
      expect(map.exists()).toBe(true)
      expect(map.attributes('aria-hidden')).toBe('true')
      // the mark covers the rows in view: 400px of 20px rows, 2px each in the minimap
      const view = wrapper.find('.dou-code-editor__minimap-view').element as HTMLElement
      expect(parseFloat(view.style.height)).toBeGreaterThanOrEqual(40)
      const scroller = wrapper.find('.dou-code-editor__scroller').element as HTMLElement
      // row 500 is at 1000px in the minimap's own scale; pressed there, it comes to the middle
      map.element.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, button: 0, clientY: 300 }),
      )
      await nextTick()
      expect(scroller.scrollTop).toBeGreaterThan(0)
      wrapper.unmount()
    } finally {
      restore()
    }
  })

  it('is left out of a narrow editor', async () => {
    const restore = sized(400, 400)
    try {
      const { wrapper } = setup(text, { minimap: true })
      await nextTick()
      expect(wrapper.find('.dou-code-editor__minimap').exists()).toBe(false)
      wrapper.unmount()
    } finally {
      restore()
    }
  })
})

describe('worker', () => {
  it('makes its worker once mounted in a browser, and ends it when unmounted', async () => {
    vi.stubGlobal('Worker', function Worker() {})
    try {
      const terminate = vi.fn<() => void>()
      const make = vi.fn<() => Worker>(
        () =>
          ({
            postMessage() {},
            addEventListener() {},
            removeEventListener() {},
            terminate,
          }) as unknown as Worker,
      )
      const { wrapper } = setup('const a = 1', { language: javascript, worker: make })
      await nextTick()
      expect(make).toHaveBeenCalledTimes(1)
      wrapper.unmount()
      expect(terminate).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('ends a worker handed to several editors with the last of them', async () => {
    vi.stubGlobal('Worker', function Worker() {})
    try {
      const terminate = vi.fn<() => void>()
      const shared = {
        postMessage() {},
        addEventListener() {},
        removeEventListener() {},
        terminate,
      } as unknown as Worker
      const a = setup('const a = 1', { language: javascript, worker: () => shared })
      const b = setup('const b = 2', { language: javascript, worker: () => shared })
      await nextTick()
      a.wrapper.unmount()
      expect(terminate).not.toHaveBeenCalled()
      b.wrapper.unmount()
      expect(terminate).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('reads on the page, saying why, when the worker can’t start', async () => {
    vi.stubGlobal('Worker', function Worker() {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { wrapper } = setup('const a = 1', {
        language: javascript,
        worker: () => {
          throw new Error('blocked')
        },
      })
      await nextTick()
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('could not start'),
        expect.any(Error),
      )
      expect(wrapper.find('.dou-syntax-keyword').exists()).toBe(true)
    } finally {
      warn.mockRestore()
      vi.unstubAllGlobals()
    }
  })
})
