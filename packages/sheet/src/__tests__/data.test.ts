import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { compareForSort, meetsCondition, meetsRule, sortRows, textCollator } from '../core/data'
import type { SheetWorkbook } from '../core/model'
import { applySheetSteps, SheetTransaction } from '../core/transaction'
import FilterPanel from '../components/filter-panel.vue'
import { DouSheet } from '../index'
import { sheetLocales } from '../locale'
import type { SheetExpose } from '../types'

describe('comparing and sorting values', () => {
  it('puts numbers, then text, then booleans, then errors', () => {
    const values = [true, '乙', 3, { code: '#N/A' }, '甲', 1, false]
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
    const sorted = [...values].sort((a, b) => compareForSort(a, b, textCollator('zh-CN')))
    expect(sorted.slice(0, 2)).toEqual([1, 3])
    expect(sorted.slice(4)).toEqual([false, true, { code: '#N/A' }])
  })

  it('reads numbers inside text by size and Chinese by pinyin', () => {
    const c = textCollator('zh-CN')
    expect(compareForSort('第2组', '第10组', c)).toBeLessThan(0)
    expect(compareForSort('杭州', '上海', c)).toBeLessThan(0)
  })

  it('keeps equal rows in order and empty values last either way', () => {
    const data: Record<number, unknown> = { 0: 2, 1: null, 2: 1, 3: 2, 4: '' }
    const at = (row: number) => data[row]
    expect(sortRows([0, 1, 2, 3, 4], [{ col: 0 }], at)).toEqual([2, 0, 3, 1, 4])
    expect(sortRows([0, 1, 2, 3, 4], [{ col: 0, order: 'desc' }], at)).toEqual([0, 3, 2, 1, 4])
  })

  it('sorts by more than one key', () => {
    const data = [
      ['上海', 3],
      ['杭州', 5],
      ['上海', 9],
    ]
    const at = (row: number, col: number) => data[row]![col]
    expect(
      sortRows([0, 1, 2], [{ col: 0 }, { col: 1, order: 'desc' }], at, textCollator('zh-CN')),
    ).toEqual([1, 2, 0])
  })
})

describe('filter rules', () => {
  it('keeps listed values, by the text shown', () => {
    expect(meetsRule({ values: ['¥1,280', ''] }, 1280, '¥1,280')).toBe(true)
    expect(meetsRule({ values: ['¥1,280'] }, null, '')).toBe(false)
    expect(meetsRule({ values: ['', '上海'] }, null, '')).toBe(true)
  })

  it('compares numbers as numbers and text without case', () => {
    expect(meetsCondition({ op: 'ge', value: 10 }, 12, '12')).toBe(true)
    expect(meetsCondition({ op: 'gt', value: '9' }, 10, '10')).toBe(true)
    expect(meetsCondition({ op: 'lt', value: 10 }, null, '')).toBe(false)
    expect(meetsCondition({ op: 'contains', value: 'BEAN' }, 'Coffee bean', 'Coffee bean')).toBe(
      true,
    )
    expect(meetsCondition({ op: 'begins', value: '上' }, '上海', '上海')).toBe(true)
    expect(meetsCondition({ op: 'blank' }, '', '')).toBe(true)
    expect(meetsCondition({ op: 'notBlank' }, 0, '0')).toBe(true)
    expect(meetsCondition({ op: 'eq', value: '上海' }, '上海', '上海')).toBe(true)
  })
})

const orders = (): SheetWorkbook => ({
  sheets: [
    {
      name: '订单',
      cells: [
        ['城市', '数量', '金额'],
        ['上海', 3, '=B2*10'],
        ['杭州', 9, '=B3*10'],
        ['苏州', 1, '=B4*10'],
        ['合计', null, '=SUM(C2:C4)'],
      ],
    },
  ],
})

describe('sortRange', () => {
  it('moves rows with their formulas, keeping the heading and the cells outside', () => {
    const tr = new SheetTransaction(orders()).sortRange('A1:C4', [{ col: 1, order: 'desc' }], {
      header: true,
    })
    const cells = tr.doc.sheets[0]!.cells
    expect(cells[0]).toEqual(['城市', '数量', '金额'])
    expect(cells.slice(1, 4)).toEqual([
      ['杭州', 9, '=B2*10'],
      ['上海', 3, '=B3*10'],
      ['苏州', 1, '=B4*10'],
    ])
    expect(cells[4]![2]).toBe('=SUM(C2:C4)')
    // undone in one go
    expect(applySheetSteps(tr.doc, tr.inverse).doc).toEqual(orders())
  })

  it('compares what valueAt gives', () => {
    const results: Record<string, number> = { '1': 30, '2': 90, '3': 10 }
    const tr = new SheetTransaction(orders()).sortRange('A2:C4', [{ col: 2 }], {
      valueAt: (row) => results[row]!,
    })
    expect(tr.doc.sheets[0]!.cells.slice(1, 4).map((r) => r![0])).toEqual(['苏州', '上海', '杭州'])
  })

  it('does not sort merged cells', () => {
    const book = orders()
    book.sheets[0]!.merges = ['A2:B2']
    expect(() =>
      new SheetTransaction(book).sortRange('A1:C4', [{ col: 1 }], { header: true }),
    ).toThrow('merged cells')
  })
})

describe('filters in transactions', () => {
  it('sets a filter and its rules, and takes it off', () => {
    const tr = new SheetTransaction(orders())
      .setFilter('A1:C4')
      .filterColumn(0, { values: ['上海'] })
      .filterColumn(1, { condition: { op: 'gt', value: 2 } })
    expect(tr.doc.sheets[0]!.filter).toEqual({
      range: 'A1:C4',
      columns: { 0: { values: ['上海'] }, 1: { condition: { op: 'gt', value: 2 } } },
    })
    tr.filterColumn(0, undefined).filterColumn(1, undefined)
    expect(tr.doc.sheets[0]!.filter).toEqual({ range: 'A1:C4' })
    tr.setFilter(null)
    expect(tr.doc.sheets[0]!.filter).toBeUndefined()
  })

  it('moves with inserted and deleted rows and columns', () => {
    const tr = new SheetTransaction(orders())
      .setFilter('A1:C4')
      .filterColumn(2, { values: ['30'] })
      .insertCols(0)
      .insertRows(2)
    expect(tr.doc.sheets[0]!.filter).toEqual({ range: 'B1:D5', columns: { 3: { values: ['30'] } } })
    tr.deleteCols('D')
    expect(tr.doc.sheets[0]!.filter).toEqual({ range: 'B1:C5' })
  })
})

function setup(book: SheetWorkbook) {
  const doc = ref(book)
  const grid = ref<SheetExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouSheet, {
          ref: grid,
          modelValue: doc.value,
          'onUpdate:modelValue': (value: SheetWorkbook) => (doc.value = value),
        }),
    ),
    { attachTo: document.body },
  )
  const input = wrapper.find('textarea.dou-sheet__input').element as HTMLTextAreaElement
  const key = async (name: string, init: KeyboardEventInit = {}) => {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }),
    )
    await nextTick()
  }
  return { wrapper, doc, grid, input, key }
}

describe('DouSheet sorting and filtering', () => {
  it('hides the rows a filter leaves out, without storing them as hidden', async () => {
    const book = orders()
    book.sheets[0]!.filter = {
      range: 'A1:C4',
      columns: { 1: { condition: { op: 'ge', value: 3 } } },
    }
    const { wrapper, doc, grid } = setup(book)
    await nextTick()
    const shown = () =>
      wrapper.findAll('[role=row]').map((row) => row.find('[aria-colindex="2"]').text())
    expect(shown()).not.toContain('苏州')
    expect(shown()).toContain('杭州')
    expect(doc.value.sheets[0]!.rowSizes).toBeUndefined()
    grid.value!.transact((tr) => tr.filterColumn(1, undefined))
    await nextTick()
    expect(shown()).toContain('苏州')
  })

  it('keeps an edited row shown until the filter changes', async () => {
    const book = orders()
    book.sheets[0]!.filter = { range: 'A1:C4', columns: { 0: { values: ['上海', '杭州'] } } }
    const { wrapper, grid } = setup(book)
    await nextTick()
    const shown = () =>
      wrapper.findAll('[role=row]').map((row) => row.find('[aria-colindex="2"]').text())
    grid.value!.transact((tr) => tr.setValue('A2', '南京'))
    await nextTick()
    expect(shown()).toContain('南京')
    grid.value!.transact((tr) =>
      tr.filterColumn(0, { values: ['上海', '杭州'] }).filterColumn(1, undefined),
    )
    await nextTick()
    grid.value!.transact((tr) => tr.filterColumn(0, { values: ['杭州'] }))
    await nextTick()
    expect(shown()).not.toContain('南京')
  })

  it('turns the filter on and off with Ctrl+Shift+L', async () => {
    const { doc, input, key } = setup(orders())
    input.focus()
    await key('l', { ctrlKey: true, shiftKey: true })
    expect(doc.value.sheets[0]!.filter?.range).toBe('A1:C5')
    await key('l', { ctrlKey: true, shiftKey: true })
    expect(doc.value.sheets[0]!.filter).toBeUndefined()
  })
})

const panel = (props: { values: string[]; numeric?: boolean }) =>
  mount(FilterPanel, {
    props: {
      rule: undefined,
      sorted: undefined,
      messages: sheetLocales['zh-CN']!,
      readonly: false,
      ...props,
    },
    attachTo: document.body,
  })

describe('the filter panel', () => {
  it('starts conditions at “≥” for number columns and “contains” for text', async () => {
    for (const [numeric, op] of [
      [true, 'ge'],
      [false, 'contains'],
    ] as const) {
      const wrapper = panel({ values: ['1', '2'], numeric })
      await wrapper.findAll('[role=radiogroup] input').at(-1)!.setValue(true)
      await wrapper.find('input[type=text]').setValue('5')
      await wrapper.findAll('.dou-sheet-filter__footer button').at(-1)!.trigger('click')
      expect(wrapper.emitted('apply')![0]).toEqual([{ condition: { op, value: 5 } }])
      wrapper.unmount()
    }
  })

  it('takes focus when it opens', async () => {
    const wrapper = panel({ values: ['上海'] })
    await nextTick()
    await nextTick()
    expect(document.activeElement?.textContent).toContain('升序')
    wrapper.unmount()
  })
})
