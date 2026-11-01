import { lineParts, tokenizeLine } from '@dou-ui/code'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouSheet, type SheetWorkbook } from '../../index'
import { DouSheetCodeFormulaBar, sheetFormula } from '../index'

const book = (): SheetWorkbook => ({
  sheets: [{ name: '表 1', cells: [[1, 2, 3], [4, 5, '=A1*2'], [null]] }],
})

function setup() {
  const doc = ref(book())
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(
          DouSheet,
          {
            modelValue: doc.value,
            'onUpdate:modelValue': (value: SheetWorkbook) => (doc.value = value),
          },
          { header: () => h(DouSheetCodeFormulaBar) },
        ),
    ),
    { attachTo: document.body },
  )
  const cell = wrapper.find('textarea.dou-sheet__input').element as HTMLTextAreaElement
  const box = () => wrapper.find('.dou-sheet-code-bar textarea').element as HTMLTextAreaElement
  const shown = () => wrapper.find('.dou-sheet-code-bar .dou-code-editor__line').text()
  const key = async (name: string, init: KeyboardEventInit = {}) => {
    const target = document.activeElement ?? cell
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: name,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    )
    await nextTick()
  }
  const typeCell = async (text: string) => {
    cell.value += text
    cell.setSelectionRange(cell.value.length, cell.value.length)
    cell.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
  }
  const typeBox = async (text: string) => {
    const el = box()
    el.focus()
    const start = el.selectionStart
    el.value = el.value.slice(0, start) + text + el.value.slice(el.selectionEnd)
    el.setSelectionRange(start + text.length, start + text.length)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
  }
  return { wrapper, doc, cell, box, shown, key, typeCell, typeBox }
}

const kinds = (line: string) =>
  lineParts(line, tokenizeLine(sheetFormula, line, sheetFormula.startState()))

describe('sheetFormula', () => {
  it('colors functions, references, text, numbers and errors', () => {
    expect(kinds(`=SUM(A1:B2,'表 2'!C3,"a""b")*2%+#N/A+TRUE`)).toEqual([
      ['=', 'operator'],
      ['SUM', 'function'],
      ['(', 'punctuation'],
      ['A1:B2', 'variable'],
      [',', 'punctuation'],
      ["'表 2'!C3", 'variable'],
      [',', 'punctuation'],
      ['"a""b"', 'string'],
      [')', 'punctuation'],
      ['*', 'operator'],
      ['2%', 'number'],
      ['+', 'operator'],
      ['#N/A', 'invalid'],
      ['+', 'operator'],
      ['TRUE', 'keyword'],
    ])
  })
})

describe('DouSheetCodeFormulaBar', () => {
  it('shows the active cell, and follows typing in the cell', async () => {
    const { cell, shown, key, typeCell } = setup()
    expect(shown()).toBe('1')
    cell.focus()
    await key('ArrowDown')
    await key('ArrowRight')
    await key('ArrowRight')
    expect(shown()).toBe('=A1*2')
    await key('ArrowDown')
    await typeCell('=B1+')
    expect(shown()).toBe('=B1+')
  })

  it('edits the cell from the box, and Enter saves', async () => {
    const { wrapper, cell, doc, typeBox, key } = setup()
    await typeBox('=A2+')
    expect(cell.value).toBe('=A2+1')
    expect(wrapper.find('.dou-sheet__input.is-open').exists()).toBe(true)
    await key('Enter')
    expect(doc.value.sheets[0]!.cells[0]![0]).toBe('=A2+1')
  })

  it('points at cells with the arrows from the box', async () => {
    const { box, cell, shown, key, typeCell } = setup()
    cell.focus()
    await key('ArrowDown')
    await key('ArrowDown')
    // an edit begun by typing points with the arrows, also from the box
    await typeCell('=')
    const el = box()
    el.focus()
    expect(shown()).toBe('=')
    await key('ArrowUp')
    expect(shown()).toBe('=A2')
    expect(cell.value).toBe('=A2')
    expect(document.activeElement).toBe(el)
  })

  it('marks references in their colors and functions that don’t exist', async () => {
    const { wrapper, typeBox } = setup()
    await typeBox('=NOPE(B1)+')
    const refs = wrapper.findAll('.dou-sheet-code-bar__ref')
    expect(refs.map((r) => [r.text(), r.classes().find((c) => c.startsWith('is-ref-'))])).toEqual([
      ['B1', 'is-ref-0'],
    ])
  })

  it('colors the formula in the cell as in the box', async () => {
    const { wrapper, cell, typeCell } = setup()
    cell.focus()
    await typeCell('=ROUND(B1,2)&"元"')
    const classes = (root: string) =>
      wrapper
        .findAll(`${root} span[class]`)
        .filter((s) => /dou-syntax-|is-ref-/.test(s.classes().join(' ')))
        .map((s) => [s.text(), s.classes().find((c) => /^(?:dou-syntax-|is-ref-)/.test(c))])
    const inCell = classes('.dou-sheet__input.is-mirror')
    expect(inCell).toEqual([
      ['=', 'dou-syntax-operator'],
      ['ROUND', 'dou-syntax-function'],
      ['(', 'dou-syntax-punctuation'],
      ['B1', 'is-ref-0'],
      [',', 'dou-syntax-punctuation'],
      ['2', 'dou-syntax-number'],
      [')', 'dou-syntax-punctuation'],
      ['&', 'dou-syntax-operator'],
      ['"元"', 'dou-syntax-string'],
    ])
    const box = wrapper.find('.dou-sheet-code-bar')
    expect(box.find('.dou-syntax-function').text()).toBe('ROUND')
    expect(
      box
        .findAll('.dou-syntax-string')
        .map((s) => s.text())
        .join(''),
    ).toBe('"元"')
  })

  it('is read-only with the sheet', async () => {
    const doc = ref(book())
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(
            DouSheet,
            { modelValue: doc.value, readonly: true },
            { header: () => h(DouSheetCodeFormulaBar) },
          ),
      ),
      { attachTo: document.body },
    )
    expect(wrapper.find('.dou-sheet-code-bar .dou-code-editor').classes()).toContain('is-readonly')
    wrapper.unmount()
  })
})
