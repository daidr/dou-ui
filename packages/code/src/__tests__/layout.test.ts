import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { ChangeSet } from '../core/changes'
import { foldEndAt, hiddenLines } from '../core/folding'
import { CodeText } from '../core/text'
import { DouCodeEditor, type CodeEditorExpose, typescript } from '../index'
import { LineLayout, rowOfCol, updateRows, wrapLine } from '../view/layout'
import { Measure } from '../view/measure'

/** Cells are 8px wide without a page to measure in. */
const measure = new Measure(() => null)
const cut = (text: string, cells: number) => {
  const { breaks } = wrapLine(text, cells * 8, measure)
  const rows: string[] = []
  let from = 0
  for (const at of [...breaks, text.length]) {
    rows.push(text.slice(from, at))
    from = at
  }
  return rows
}

describe('wrapLine', () => {
  it('leaves a line that fits alone', () => {
    expect(wrapLine('short', 80, measure).breaks).toEqual([])
  })

  it('breaks after spaces and punctuation, before a dot, and inside a word only when it must', () => {
    expect(cut('one two three four', 9)).toEqual(['one two ', 'three ', 'four'])
    expect(cut('call(first,second)', 10)).toEqual(['call(', 'first,', 'second)'])
    expect(cut('store.orders.reduce', 10)).toEqual(['store', '.orders', '.reduce'])
    expect(cut('abcdefghijkl', 5)).toEqual(['abcde', 'fghij', 'kl'])
  })

  it('breaks between Chinese characters', () => {
    // Wide characters take two cells here.
    expect(cut('你好世界再见', 5)).toEqual(['你好', '世界', '再见'])
  })

  it('lines rows after the first up with the indentation', () => {
    const text = '    one two three'
    const wrapped = wrapLine(text, 10 * 8, measure)
    expect(wrapped.indent).toBe(32)
    expect(cut(text, 10)).toEqual(['    one ', 'two ', 'three'])
    expect(rowOfCol(wrapped, 0)).toBe(0)
    expect(rowOfCol(wrapped, 8)).toBe(1)
    expect(rowOfCol(wrapped, text.length)).toBe(2)
  })
})

const valueOf = (text: string) => text.length

describe('LineLayout', () => {
  it('counts rows of wrapped lines and skips hidden ones', () => {
    const layout = new LineLayout(6, [1, 3, 1, 1, 2, 1], [[3, 4]])
    expect(layout.total).toBe(7)
    expect([1, 2, 3, 4, 5, 6].map((n) => layout.rowOf(n))).toEqual([0, 1, 4, 4, 4, 6])
    expect([0, 1, 2, 3, 4, 5, 6].map((row) => layout.lineAtRow(row))).toEqual([
      { n: 1, sub: 0 },
      { n: 2, sub: 0 },
      { n: 2, sub: 1 },
      { n: 2, sub: 2 },
      { n: 5, sub: 0 },
      { n: 5, sub: 1 },
      { n: 6, sub: 0 },
    ])
    expect(layout.shown(3)).toBe(false)
    expect(layout.lineAtRow(99)).toEqual({ n: 6, sub: 0 })
  })

  it('is plain arithmetic when every line is one row', () => {
    const layout = new LineLayout(100, null, [])
    expect(layout.uniform).toBe(true)
    expect(layout.rowOf(50)).toBe(49)
    expect(layout.lineAtRow(49)).toEqual({ n: 50, sub: 0 })
  })

  it('keeps per-line values right through random edits', () => {
    let seed = 7
    const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const words = ['', 'a', 'long words here', '\n', '\n\n', 'x\ny', '你好']
    let doc = CodeText.of('one\ntwo three\n\nfour five six\nseven')
    const rows = doc.lineTexts(1, doc.lines).map(valueOf)
    for (let round = 0; round < 300; round++) {
      const specs = []
      let pos = 0
      while (pos <= doc.length && specs.length < 3) {
        const from = pos + Math.floor(next() * 5)
        if (from > doc.length) break
        const to = Math.min(doc.length, from + Math.floor(next() * 4))
        specs.push({ from, to, insert: words[Math.floor(next() * words.length)]! })
        pos = to + 1
      }
      const changes = ChangeSet.of(specs, doc.length)
      const after = changes.apply(doc)
      expect(updateRows(rows, doc, after, changes, valueOf)).toBe(true)
      expect(rows).toEqual(after.lineTexts(1, after.lines).map(valueOf))
      doc = after
    }
  })
})

describe('foldEndAt', () => {
  const doc = CodeText.of(
    [
      'function a() {',
      '  if (x) {',
      '    y()',
      '  }',
      '}',
      'list:',
      '  - one',
      '',
      '  - two',
      'end',
    ].join('\n'),
  )
  it('folds a bracket block up to the line before its partner', () => {
    expect(foldEndAt(doc, 1, { brackets: '()[]{}' })).toBe(4)
    expect(foldEndAt(doc, 2, { brackets: '()[]{}' })).toBe(3)
    expect(foldEndAt(doc, 3, { brackets: '()[]{}' })).toBeNull()
  })

  it('folds deeper indented lines, past blank ones', () => {
    expect(foldEndAt(doc, 6)).toBe(9)
    expect(foldEndAt(doc, 10)).toBeNull()
  })

  it('merges the lines hidden by nested folds', () => {
    const folds = [
      { from: doc.line(2).to, to: doc.line(3).to },
      { from: doc.line(1).to, to: doc.line(4).to },
    ]
    expect(hiddenLines(doc, folds)).toEqual([[2, 4]])
  })
})

function setup(initial: string, extra: Record<string, unknown> = {}) {
  const code = ref(initial)
  const editor = ref<CodeEditorExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouCodeEditor, {
          ref: editor,
          modelValue: code.value,
          'onUpdate:modelValue': (value: string) => (code.value = value),
          style: 'height: 400px',
          ...extra,
        }),
    ),
    { attachTo: document.body },
  )
  const textarea = wrapper.find('textarea').element as HTMLTextAreaElement
  textarea.focus()
  const key = async (name: string, init: KeyboardEventInit = {}) => {
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }),
    )
    await nextTick()
  }
  const head = () => editor.value!.selection.ranges[editor.value!.selection.main]!.head
  const numbers = () => wrapper.findAll('.dou-code-editor__number').map((n) => n.text())
  return { wrapper, code, editor, key, head, numbers }
}

describe('folding in the editor', () => {
  const source = ['function a() {', '  one()', '  two()', '}', 'after()'].join('\n')

  it('folds and unfolds from the gutter, the marker and the keyboard', async () => {
    const { wrapper, editor, key, numbers } = setup(source, { language: typescript })
    expect(editor.value!.fold(1)).toBe(true)
    await nextTick()
    expect(numbers()).toEqual(['1', '4', '5'])
    expect(editor.value!.folds).toEqual([1])
    expect(wrapper.find('.dou-code-editor__fold-marker').exists()).toBe(true)
    await wrapper.find('.dou-code-editor__fold-marker').trigger('pointerdown', { button: 0 })
    expect(editor.value!.folds).toEqual([])
    editor.value!.select(20)
    await key('[', { ctrlKey: true, shiftKey: true, code: 'BracketLeft' })
    expect(editor.value!.folds).toEqual([1])
    // The cursor inside the block moved to its first line.
    expect(editor.value!.selection.ranges[0]!.head).toBe(14)
    await key(']', { ctrlKey: true, shiftKey: true, code: 'BracketRight' })
    expect(editor.value!.folds).toEqual([])
  })

  it('moves over a fold, and unfolds when a cursor lands inside', async () => {
    const { editor, key, head } = setup(source, { language: typescript })
    editor.value!.fold(1)
    editor.value!.select(3)
    await key('ArrowDown')
    // From line 1 straight to the end of line 4.
    expect(head()).toBe(source.indexOf('}') + 1)
    editor.value!.select(source.indexOf('two'))
    await nextTick()
    expect(editor.value!.folds).toEqual([])
  })

  it('keeps folds through edits above them, and folds every block at once', async () => {
    const { editor } = setup(source + '\nfunction b() {\n  three()\n}', { language: typescript })
    expect(editor.value!.foldAll()).toBe(true)
    expect(editor.value!.folds).toEqual([1, 6])
    editor.value!.transact((tr) => tr.insert(0, '// top\n'))
    await nextTick()
    expect(editor.value!.folds).toEqual([2, 7])
    expect(editor.value!.unfoldAll()).toBe(true)
    expect(editor.value!.folds).toEqual([])
  })
})

describe('wrapping in the editor', () => {
  it('draws long lines as rows and moves the cursor row by row', async () => {
    // Without a page to measure, rows are 8 cells wide.
    const text = 'aaaa bbbb cccc dddd\nshort'
    const { wrapper, editor, key, head } = setup(text, { wrap: true })
    await nextTick()
    expect(wrapper.findAll('.dou-code-editor__row').map((row) => row.element.textContent)).toEqual([
      'aaaa ',
      'bbbb ',
      'cccc ',
      'dddd',
    ])
    editor.value!.select(1)
    await key('ArrowDown')
    expect(head()).toBe(6)
    await key('ArrowDown')
    await key('ArrowDown')
    expect(head()).toBe(16)
    await key('ArrowDown')
    expect(head()).toBe(text.indexOf('short') + 1)
  })
})
