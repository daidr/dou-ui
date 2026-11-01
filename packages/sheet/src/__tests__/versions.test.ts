import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouSheet } from '../index'
import type { SheetExpose } from '../types'
import type { SheetWorkbook } from '../core/model'
import { SheetTransaction } from '../core/transaction'
import { diffWorkbooks, restoreWorkbook } from '../core/versions'

const v1 = (): SheetWorkbook => ({
  styles: { head: { bold: true } },
  sheets: [
    {
      id: 'budget',
      name: '预算',
      cells: [
        [
          { value: '项目', style: 'head' },
          { value: '金额', style: 'head' },
        ],
        ['场地', 48000],
        ['物料', 12600],
      ],
    },
    { id: 'notes', name: '备注', cells: [['上海站']] },
  ],
})

const v2 = (): SheetWorkbook => ({
  styles: { head: { bold: true, color: '#555' } },
  sheets: [
    {
      id: 'budget',
      name: '预算',
      colSizes: { 0: 120 },
      cells: [
        [
          { value: '项目', style: 'head' },
          { value: '金额', style: 'head' },
        ],
        [{ value: '场地', comment: 't1' }, 52000],
        ['物料', 12600],
        ['交通', 3000],
      ],
    },
    { id: 'people', name: '人员', cells: [['戴兜']] },
  ],
})

describe('diffWorkbooks', () => {
  it('lists the changed cells and the sheets added, removed and changed', () => {
    const diff = diffWorkbooks(v1(), v2())
    expect(diff.cells.map((c) => `${c.sheet}!${c.address}`)).toEqual([
      'budget!B2',
      'budget!A4',
      'budget!B4',
    ])
    expect(diff.cells[0]).toMatchObject({ before: 48000, after: 52000 })
    expect(diff.addedSheets).toEqual(['people'])
    expect(diff.removedSheets).toEqual(['notes'])
    expect(diff.changedSheets).toEqual(['budget'])
  })

  it('takes empty text for an empty cell', () => {
    const a: SheetWorkbook = { sheets: [{ id: 's', name: 's', cells: [['甲', '']] }] }
    const b: SheetWorkbook = { sheets: [{ id: 's', name: 's', cells: [['甲']] }] }
    expect(diffWorkbooks(a, b).cells).toEqual([])
  })
})

describe('restoreWorkbook', () => {
  it('writes only what differs and keeps the threads on their cells', () => {
    const tr = restoreWorkbook(new SheetTransaction(v2()), v1())
    const book = tr.doc
    expect(book.sheets.map((s) => s.id)).toEqual(['budget', 'notes'])
    expect(book.styles).toEqual(v1().styles)
    const budget = book.sheets[0]!
    expect(budget.colSizes ?? {}).toEqual({})
    expect(budget.cells[1]).toEqual([{ value: '场地', comment: 't1' }, 48000])
    expect(budget.cells[3] ?? []).toEqual([undefined, undefined])
    // only the cells that differ are written
    const cells = tr.steps.filter((step) => step.type === 'setCell')
    expect(cells).toHaveLength(3)
    // and the transaction undoes like any other
    expect(diffWorkbooks(tr.before, v2()).cells).toEqual([])
  })
})

afterEach(() => {
  document.body.innerHTML = ''
})

function setup(props: Record<string, unknown>) {
  const book = ref(v2())
  const grid = ref<SheetExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouSheet, {
          ref: grid,
          modelValue: book.value,
          'onUpdate:modelValue': (value: SheetWorkbook) => (book.value = value),
          ...props,
        }),
    ),
    { attachTo: document.body },
  )
  return { wrapper, book, grid }
}

describe('DouSheet versions', () => {
  it('marks the changed cells read-only, and goes from one to the next', async () => {
    const { wrapper, grid } = setup({ compare: v1() })
    await nextTick()
    const changed = wrapper.findAll('.dou-sheet__cell.is-changed')
    expect(changed).toHaveLength(3)
    expect(changed[0]!.attributes('title')).toBe('原来：48000')
    expect(changed[1]!.attributes('title')).toBe('原来为空')
    expect(wrapper.find('.dou-sheet').classes()).toContain('is-comparing')
    expect(grid.value!.transact((tr) => tr.setValue('A1', '改'))).toBeNull()

    expect(grid.value!.nextChange()).toBe(true)
    expect(grid.value!.nextChange()).toBe(true)
    expect(grid.value!.nextChange()).toBe(true)
    expect(grid.value!.nextChange()).toBe(false)
    expect(grid.value!.previousChange()).toBe(true)
    wrapper.unmount()
  })

  it('restores a version as one change undo takes back', async () => {
    const { wrapper, book, grid } = setup({})
    await nextTick()
    expect(grid.value!.restore(v1())).toBe(true)
    expect(book.value.sheets.map((s) => s.name)).toEqual(['预算', '备注'])
    expect(book.value.sheets[0]!.cells[1]).toEqual([{ value: '场地', comment: 't1' }, 48000])
    expect(grid.value!.restore(v1())).toBe(false)
    expect(grid.value!.undo()).toBe(true)
    expect(diffWorkbooks(book.value, v2()).cells).toEqual([])
    expect(book.value.sheets.map((s) => s.name)).toEqual(['预算', '人员'])
    wrapper.unmount()
  })
})
