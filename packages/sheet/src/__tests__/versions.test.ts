import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouSheet } from '../index'
import type { SheetExpose } from '../types'
import type { SheetWorkbook } from '../core/model'
import { SheetTransaction } from '../core/transaction'
import { diffWorkbooks, restoreWorkbook } from '../core/versions'

const v1 = (): SheetWorkbook => ({
  version: 1,
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
  version: 1,
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

  it('takes the ways of writing one cell for the same cell', () => {
    const a: SheetWorkbook = {
      version: 1,
      sheets: [
        {
          id: 's',
          name: 's',
          cells: [
            ['甲', '', { value: 1 }, null, { value: 2, note: undefined }, { style: 'x', value: 3 }],
          ],
        },
      ],
    }
    const b: SheetWorkbook = {
      version: 1,
      sheets: [
        {
          id: 's',
          name: 's',
          cells: [['甲', null, 1, { value: '' }, 2, { value: 3, style: 'x' }]],
        },
      ],
    }
    expect(diffWorkbooks(a, b).cells).toEqual([])
    expect(restoreWorkbook(new SheetTransaction(b), a).changed).toBe(false)
  })

  it('counts protection, named styles and the workbook settings', () => {
    const a = v1()
    const b = v1()
    b.protect = true
    b.sheets[0]!.protect = { insertRows: true }
    b.styles = { ...b.styles, open: { locked: false } }
    b.sheets[0]!.cells[1]![0] = { value: '场地', link: 'https://example.com' }
    const diff = diffWorkbooks(a, b)
    expect(diff.cells.map((c) => c.address)).toEqual(['A2'])
    expect(diff.changedSheets).toEqual(['budget'])
    expect(diff.changedStyles).toEqual(['open'])
    expect(diff.bookChanged).toBe(true)
    // and restoring brings each back
    const tr = restoreWorkbook(new SheetTransaction(b), a)
    expect(diffWorkbooks(tr.doc, a)).toMatchObject({
      cells: [],
      changedSheets: [],
      changedStyles: [],
      bookChanged: false,
    })
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
    expect(grid.value!.transact((tr) => tr.setValue('A1', '改')).changed).toBe(false)

    expect(grid.value!.nextChange()).toBe(true)
    expect(grid.value!.nextChange()).toBe(true)
    expect(grid.value!.nextChange()).toBe(true)
    expect(grid.value!.nextChange()).toBe(false)
    expect(grid.value!.previousChange()).toBe(true)
    wrapper.unmount()
  })

  it('shows what a changed cell held as it showed then: formatted, formulas worked out', async () => {
    const before: SheetWorkbook = {
      version: 1,
      sheets: [
        {
          id: 's',
          name: 's',
          cells: [[{ value: 45000, format: '¥#,##0' }, 12600, '=A1+B1']],
        },
      ],
    }
    const now: SheetWorkbook = {
      version: 1,
      sheets: [{ id: 's', name: 's', cells: [[{ value: 48000, format: '¥#,##0' }, 12600, 60600]] }],
    }
    const grid = ref<SheetExpose>()
    const mounted = mount(
      defineComponent(() => () => h(DouSheet, { ref: grid, modelValue: now, compare: before })),
      { attachTo: document.body },
    )
    await nextTick()
    const titles = mounted.findAll('.dou-sheet__cell.is-changed').map((c) => c.attributes('title'))
    expect(titles).toEqual(['原来：¥45,000', '原来：57600'])
    mounted.unmount()
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

  it('restores while comparing, over protection, and from code on a read-only grid', async () => {
    const protectedBook = v2()
    protectedBook.sheets[0]!.protect = true
    const compared = setup({ compare: v1() })
    compared.book.value = protectedBook
    await nextTick()
    expect(compared.grid.value!.restore(v1())).toBe(true)
    expect(compared.book.value.sheets[0]!.protect).toBeUndefined()
    expect(compared.book.value.sheets[0]!.cells[1]![1]).toBe(48000)
    compared.wrapper.unmount()

    // comparing, nothing else changes the workbook, not even code
    const comparing = setup({ compare: v1() })
    await nextTick()
    expect(comparing.grid.value!.transact((tr) => tr.setValue('A1', '改')).changed).toBe(false)
    expect(comparing.grid.value!.undo()).toBe(false)
    comparing.wrapper.unmount()

    const readonly = setup({ readonly: true })
    await nextTick()
    expect(readonly.grid.value!.restore(v1())).toBe(true)
    readonly.wrapper.unmount()
  })
})
