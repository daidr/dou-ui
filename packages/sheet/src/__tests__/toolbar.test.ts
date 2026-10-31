import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  applySheetSteps,
  changeDecimals,
  DouSheet,
  DouSheetToolbar,
  SheetTransaction,
  type SheetSelection,
  type SheetWorkbook,
} from '../index'

const book = (): SheetWorkbook => ({
  sheets: [
    {
      name: '预算',
      cells: [
        ['项目', '金额'],
        ['场地', { value: 1280, style: 'head' }],
        ['餐饮', 640.5],
      ],
      rowCount: 10,
      colCount: 4,
    },
  ],
  styles: { head: { bold: true } },
})

describe('styleCells', () => {
  it('lays a patch over each style, sharing styles that look the same', () => {
    const tr = new SheetTransaction(book()).styleCells('A1:B2', { italic: true })
    const cells = tr.doc.sheets[0]!.cells
    // plain cells share one new style; the bold one gets bold + italic
    expect(cells[0]![0]).toEqual({ value: '项目', style: 's1' })
    expect(cells[0]![1]).toEqual({ value: '金额', style: 's1' })
    expect(cells[1]![1]).toEqual({ value: 1280, style: 's2' })
    expect(tr.doc.styles).toEqual({
      head: { bold: true },
      s1: { italic: true },
      s2: { bold: true, italic: true },
    })
    // a style that matches one there already uses it
    const again = new SheetTransaction(tr.doc).styleCells('C1', { bold: true })
    expect(again.doc.sheets[0]!.cells[0]![2]).toEqual({ style: 'head' })
    expect(again.doc.styles).toBe(tr.doc.styles)
  })

  it('takes fields off with undefined or false, and whole styles with null', () => {
    const tr = new SheetTransaction(book()).styleCells('B2', { bold: false })
    expect(tr.doc.sheets[0]!.cells[1]![1]).toBe(1280)
    const styled = new SheetTransaction(book()).styleCells('A1:A3', { tone: 'danger', bold: true })
    const cleared = new SheetTransaction(styled.doc).styleCells('A:A', null)
    expect(cleared.doc.sheets[0]!.cells.map((row) => row?.[0])).toEqual(['项目', '场地', '餐饮'])
  })

  it('stops whole columns at the sheet edge, and undoes as one', () => {
    const before = book()
    const tr = new SheetTransaction(before).styleCells('D:D', { fill: 'primary' })
    const cells = tr.doc.sheets[0]!.cells
    expect(cells.length).toBe(10)
    expect(cells[9]![3]).toEqual({ style: 's1' })
    const undone = applySheetSteps(tr.doc, tr.inverse).doc
    expect(undone.sheets[0]!.cells.slice(0, 3).map((row) => row?.slice(0, 2))).toEqual(
      before.sheets[0]!.cells,
    )
    expect(undone.sheets[0]!.cells.flat().filter((cell) => cell !== undefined).length).toBe(6)
    expect(undone.styles).toEqual(before.styles)
  })

  it('leaves cells alone when nothing changes', () => {
    const tr = new SheetTransaction(book()).styleCells('B2', { bold: true })
    expect(tr.changed).toBe(false)
  })
})

describe('formatCells and changeDecimals', () => {
  it('sets formats, or changes each with a function', () => {
    const tr = new SheetTransaction(book()).formatCells('B2:B3', '#,##0.00')
    expect(tr.doc.sheets[0]!.cells[2]![1]).toEqual({ value: 640.5, format: '#,##0.00' })
    const more = new SheetTransaction(tr.doc).formatCells('B2:B3', (format, value) =>
      changeDecimals(format, value, 1),
    )
    expect(more.doc.sheets[0]!.cells[1]![1]).toEqual({
      value: 1280,
      style: 'head',
      format: '#,##0.000',
    })
    const none = new SheetTransaction(more.doc).formatCells('B2:B3', undefined)
    expect(none.doc.sheets[0]!.cells[2]![1]).toBe(640.5)
  })

  it('adds and takes off digits after the point', () => {
    expect(changeDecimals('0.00', 1, 1)).toBe('0.000')
    expect(changeDecimals('0.0', 1, -1)).toBe('0')
    expect(changeDecimals('0', 1, -1)).toBe('0')
    expect(changeDecimals('#,##0', 1, 1)).toBe('#,##0.0')
    expect(changeDecimals('0.0%', 1, -1)).toBe('0%')
    expect(changeDecimals('¥#,##0.00;-¥#,##0.00', 1, 1)).toBe('¥#,##0.000;-¥#,##0.000')
    expect(changeDecimals('"0.0 元"0.0', 1, 1)).toBe('"0.0 元"0.00')
    // without a format: from the digits the value shows
    expect(changeDecimals(undefined, 640.5, 1)).toBe('0.00')
    expect(changeDecimals(undefined, 640.5, -1)).toBe('0')
    expect(changeDecimals(undefined, 'text', 1)).toBe('0.0')
    // dates and text stay
    expect(changeDecimals('yyyy-mm-dd', '2026-03-05', 1)).toBe('yyyy-mm-dd')
    expect(changeDecimals('@', 1, 1)).toBe('@')
  })
})

function setup(props: Record<string, unknown> = {}) {
  const doc = ref(book())
  const selection = ref<SheetSelection>({
    active: { row: 1, col: 0 },
    ranges: [{ start: { row: 1, col: 0 }, end: { row: 2, col: 1 } }],
  })
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(
          DouSheet,
          {
            modelValue: doc.value,
            'onUpdate:modelValue': (value: SheetWorkbook) => (doc.value = value),
            selection: selection.value,
            'onUpdate:selection': (value: SheetSelection) => (selection.value = value),
            ...props,
          },
          { header: () => h(DouSheetToolbar) },
        ),
    ),
    { attachTo: document.body },
  )
  const button = (label: string) => wrapper.find(`.dou-sheet-toolbar [aria-label="${label}"]`)
  return { wrapper, doc, selection, button }
}

describe('DouSheetToolbar', () => {
  it('shows the active cell and changes the selection', async () => {
    const { wrapper, doc, button } = setup()
    expect(wrapper.find('[role="toolbar"]').exists()).toBe(true)
    expect(button('加粗').attributes('aria-pressed')).toBe('false')
    await button('加粗').trigger('click')
    const cells = doc.value.sheets[0]!.cells
    expect(cells[1]![0]).toEqual({ value: '场地', style: 'head' })
    expect(cells[2]![1]).toEqual({ value: 640.5, style: 'head' })
    expect(button('加粗').attributes('aria-pressed')).toBe('true')
    // undo takes it back
    await button('撤销').trigger('click')
    expect(doc.value.sheets[0]!.cells[1]![0]).toBe('场地')
    wrapper.unmount()
  })

  it('aligns, wraps and merges', async () => {
    const { wrapper, doc, button } = setup()
    await button('居中').trigger('click')
    expect(doc.value.styles!.s1).toEqual({ align: 'center' })
    await button('自动换行').trigger('click')
    const style = doc.value.sheets[0]!.cells[1]![0] as { style: string }
    expect(doc.value.styles![style.style]).toEqual({ align: 'center', wrap: true })
    await button('合并单元格').trigger('click')
    expect(doc.value.sheets[0]!.merges).toEqual(['A2:B3'])
    expect(button('合并单元格').attributes('aria-pressed')).toBe('true')
    await button('合并单元格').trigger('click')
    expect(doc.value.sheets[0]!.merges).toBeUndefined()
    wrapper.unmount()
  })

  it('shows only the tools asked for, without stray lines', () => {
    const { wrapper } = setup()
    wrapper.unmount()
    const doc = ref(book())
    const only = mount(
      defineComponent(
        () => () =>
          h(
            DouSheet,
            { modelValue: doc.value },
            { header: () => h(DouSheetToolbar, { tools: ['|', 'bold', '|', '|', 'italic', '|'] }) },
          ),
      ),
      { attachTo: document.body },
    )
    expect(only.findAll('.dou-sheet-toolbar button').length).toBe(2)
    expect(only.findAll('.dou-toolbar-separator').length).toBe(1)
    only.unmount()
  })

  it('takes the grid keys for bold and clearing', async () => {
    const { wrapper, doc } = setup()
    const input = wrapper.find('textarea').element
    const key = async (name: string, init: KeyboardEventInit = {}) => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }),
      )
      await nextTick()
    }
    await key('b', { ctrlKey: true })
    expect(doc.value.sheets[0]!.cells[1]![0]).toEqual({ value: '场地', style: 'head' })
    await key('\\', { ctrlKey: true })
    expect(doc.value.sheets[0]!.cells[1]![0]).toBe('场地')
    expect(doc.value.sheets[0]!.cells[1]![1]).toBe(1280)
    wrapper.unmount()
  })

  it('is disabled when the grid is read-only', () => {
    const { wrapper, button } = setup({ readonly: true })
    expect(button('加粗').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
