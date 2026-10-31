import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { collaboration, fillBook, readBook } from '..'
import { DouSheet } from '../../index'
import type { SheetExpose, SheetWorkbook } from '../../index'
import { anchorFormula, resolveFormula, SheetLayout, SheetLines } from '../anchor'
import { syncList } from '../shared'

const START = (): SheetWorkbook => ({
  styles: { head: { bold: true } },
  sheets: [
    {
      id: 'sales',
      name: '销售',
      rowCount: 20,
      colCount: 6,
      colSizes: { 0: 96 },
      freeze: { rows: 1 },
      merges: ['E1:F1'],
      cells: [
        [{ value: '门店', style: 'head' }, { value: '金额', style: 'head' }, null, null, '备注'],
        ['上海', 120],
        ['杭州', 80],
        ['南京', 50],
        ['合计', '=SUM(B2:B4)'],
      ],
      conditionalFormats: [{ range: 'B2:B4', when: { op: 'gt', value: 100 }, style: 'head' }],
      validations: [{ range: 'A2:A4', list: '=城市!$A$1:$A$3' }],
    },
    {
      id: 'cities',
      name: '城市',
      rowCount: 10,
      colCount: 4,
      cells: [['上海'], ['杭州'], ['南京'], [null, '=销售!B5*2']],
    },
  ],
})

const wrappers: VueWrapper[] = []
const awarenesses: Awareness[] = []
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  for (const awareness of awarenesses.splice(0)) awareness.destroy()
  document.body.innerHTML = ''
})

const flush = async () => {
  for (let round = 0; round < 3; round++) {
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve))
  }
}

function client(
  start: SheetWorkbook,
  options: { awareness?: boolean; name?: string; readonly?: boolean } = {},
  /** What the shared document already holds when the grid opens. */
  from?: Y.Doc,
) {
  const doc = new Y.Doc()
  if (from) Y.applyUpdate(doc, Y.encodeStateAsUpdate(from))
  const awareness = options.awareness ? new Awareness(doc) : undefined
  if (awareness) awarenesses.push(awareness)
  const book = ref(start)
  const extension = collaboration({
    book: doc.getMap('book'),
    awareness,
    user: options.name ? { name: options.name } : undefined,
  })
  const grid = ref<SheetExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouSheet, {
          ref: grid,
          modelValue: book.value,
          'onUpdate:modelValue': (next: SheetWorkbook) => (book.value = next),
          extensions: [extension],
          readonly: options.readonly,
        }),
    ),
    { attachTo: document.body },
  )
  wrappers.push(wrapper)
  return { doc, awareness, book, grid: () => grid.value!, wrapper }
}

/** Two clients that send each other their changes while `online`, the first one filling the workbook. */
async function pair(options: { awareness?: boolean; readonly?: boolean } = {}) {
  const a = client(START(), { awareness: options.awareness, name: '戴兜' })
  await flush()
  const b = client(
    { sheets: [{ name: '空', cells: [] }] },
    { awareness: options.awareness, name: '阿青', readonly: options.readonly },
    a.doc,
  )
  const link = { online: true }
  const pending: (() => void)[] = []
  const send = (apply: () => void) => (link.online ? apply() : pending.push(apply))
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as const) {
    from.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'peer') send(() => Y.applyUpdate(to.doc, update, 'peer'))
    })
    if (from.awareness && to.awareness) {
      const target = to.awareness
      const source = from.awareness
      source.on(
        'update',
        ({ added, updated, removed }: Record<string, number[]>, origin: unknown) => {
          if (origin === 'peer') return
          const update = encodeAwarenessUpdate(source, [...added!, ...updated!, ...removed!])
          send(() => applyAwarenessUpdate(target, update, 'peer'))
        },
      )
      applyAwarenessUpdate(target, encodeAwarenessUpdate(source, [source.clientID]), 'peer')
    }
  }
  await flush()
  return {
    a,
    b,
    async offline() {
      link.online = false
    },
    async online() {
      link.online = true
      for (const apply of pending.splice(0)) apply()
      await flush()
    },
  }
}

/** A workbook as JSON keeps it: empty cells are empty however they were written. */
const plain = (book: SheetWorkbook) => JSON.parse(JSON.stringify(book)) as SheetWorkbook

const cell = (book: SheetWorkbook, sheet: number, row: number, col: number) => {
  const value = book.sheets[sheet]!.cells[row]?.[col]
  return typeof value === 'object' && value !== null ? value.value : value
}

describe('anchored formulas', () => {
  const layout = new SheetLayout()
  const here = {
    id: 's',
    name: '表',
    rows: new SheetLines(['r0', 'r1', 'r2', 'r3']),
    cols: new SheetLines(['a', 'b', 'c']),
  }
  const other = {
    id: 'o',
    name: '其他 表',
    rows: new SheetLines(['x0', 'x1']),
    cols: new SheetLines(['p', 'q']),
  }
  layout.sheets.set('s', here)
  layout.sheets.set('o', other)

  it('keeps the text as written while the lines stay', () => {
    const formula = "=SUM($a1:B3)+'其他 表'!q2+C:C+2:2+未知!A1"
    const refs = anchorFormula(formula, here, layout)!
    expect(resolveFormula(formula, refs, here, layout)).toBe(formula)
  })

  it('follows moved lines, renamed sheets and reads #REF! for deleted ones', () => {
    const formula = "=SUM(A2:B3)+'其他 表'!B2"
    const refs = anchorFormula(formula, here, layout)!
    here.rows.ids = ['new', 'r0', 'r1', 'r2', 'r3']
    here.rows.changed()
    other.name = '城市'
    expect(resolveFormula(formula, refs, here, layout)).toBe('=SUM(A3:B4)+城市!B2')
    here.rows.ids = ['new', 'r0', 'r2', 'r3']
    here.rows.changed()
    expect(resolveFormula(formula, refs, here, layout)).toBe('=SUM(#REF!)+城市!B2')
    layout.sheets.delete('o')
    expect(resolveFormula(formula, refs, here, layout)).toBe('=SUM(#REF!)+#REF!')
  })
})

describe('fillBook and readBook', () => {
  it('give back the workbook they were filled with', () => {
    const doc = new Y.Doc()
    const book = doc.getMap('book')
    fillBook(book, START())
    const read = readBook(book)
    expect(read.styles).toEqual(START().styles)
    expect(read.sheets.map((sheet) => sheet.id)).toEqual(['sales', 'cities'])
    const sales = read.sheets[0]!
    expect(sales.cells).toEqual(
      START().sheets[0]!.cells.map((row) => row?.map((c) => c ?? undefined)),
    )
    expect(sales).toMatchObject({
      name: '销售',
      rowCount: 20,
      colCount: 6,
      colSizes: { 0: 96 },
      freeze: { rows: 1 },
      merges: ['E1:F1'],
      conditionalFormats: START().sheets[0]!.conditionalFormats,
      validations: START().sheets[0]!.validations,
    })
  })

  it('gives sheets without an id one', () => {
    const doc = new Y.Doc()
    fillBook(doc.getMap('book'), { sheets: [{ name: '表', cells: [[1]] }] })
    const [sheet] = readBook(doc.getMap('book')).sheets
    expect(sheet!.id).toBeTypeOf('string')
    expect(sheet!.cells).toEqual([[1]])
  })
})

describe('syncList', () => {
  it('keeps the run in order and moves the rest', () => {
    const doc = new Y.Doc()
    const list = doc.getArray<string>('list')
    list.push(['a', 'b', 'c', 'd', 'b'])
    syncList(list, ['d', 'a', 'b', 'e'])
    expect(list.toArray()).toEqual(['d', 'a', 'b', 'e'])
  })
})

describe('collaboration', () => {
  it('reads the shared workbook and sends each change to the other side', async () => {
    const { a, b } = await pair()
    expect(b.book.value.sheets.map((sheet) => sheet.name)).toEqual(['销售', '城市'])
    expect(cell(b.book.value, 0, 4, 1)).toBe('=SUM(B2:B4)')

    a.grid().transact((tr) => tr.setValue('B2', 150))
    await flush()
    expect(cell(b.book.value, 0, 1, 1)).toBe(150)

    b.grid().transact((tr) => tr.styleCells('A2', { italic: true }))
    await flush()
    expect(a.book.value.sheets[0]!.cells[1]![0]).toEqual(b.book.value.sheets[0]!.cells[1]![0])
  })

  it('keeps cells and formulas in place when both sides change lines at once', async () => {
    const { a, b, offline, online } = await pair()
    await offline()
    // 戴兜 adds a row at the top of the data; 阿青 deletes 南京 and writes below
    a.grid().transact((tr) => tr.insertRows(1))
    a.grid().transact((tr) => tr.setCells('A2', [['苏州', 30]]))
    b.grid().transact((tr) => tr.deleteRows('4'))
    b.grid().transact((tr) => tr.setValue('C4', '=B4*2'))
    await online()

    for (const side of [a, b]) {
      const rows = side.book.value.sheets[0]!.cells.map((row) =>
        cell({ sheets: [{ name: '', cells: [row] }] }, 0, 0, 0),
      )
      expect(rows.slice(0, 5)).toEqual(['门店', '苏州', '上海', '杭州', '合计'])
      // 阿青's formula was written on 合计's row and still points at 合计
      expect(cell(side.book.value, 0, 4, 2)).toBe('=B5*2')
    }
    expect(plain(a.book.value)).toEqual(plain(b.book.value))
    // the total moved down with the row added above its range and shrank with the deleted one
    expect(cell(a.book.value, 0, 4, 1)).toBe('=SUM(B3:B4)')
    // rules move with their cells
    expect(a.book.value.sheets[0]!.conditionalFormats![0]!.range).toBe('B3:B4')
  })

  it('reads #REF! where a formula pointed at a row the other side deleted', async () => {
    const { a, b, offline, online } = await pair()
    await offline()
    a.grid().transact((tr) => tr.setValue('D1', '=B2+B3'))
    b.grid().transact((tr) => tr.deleteRows('2'))
    await online()
    expect(cell(a.book.value, 0, 0, 3)).toBe('=#REF!+B2')
    expect(plain(a.book.value)).toEqual(plain(b.book.value))
  })

  it('names a renamed sheet anew in the formulas of the other side', async () => {
    const { a, b } = await pair()
    a.grid().transact((tr) => tr.renameSheet('cities', '城市列表'))
    await flush()
    expect(b.book.value.sheets[1]!.name).toBe('城市列表')
    expect(b.book.value.sheets[0]!.validations![0]!).toMatchObject({ list: '=城市列表!$A$1:$A$3' })
  })

  it('keeps a row both sides moved at once once', async () => {
    const { a, b, offline, online } = await pair()
    await offline()
    a.grid().transact((tr) => tr.moveRows('2', '5'))
    b.grid().transact((tr) => tr.moveRows('2', '4'))
    await online()
    await flush()
    expect(plain(a.book.value)).toEqual(plain(b.book.value))
    const names = a.book.value.sheets[0]!.cells.slice(0, 5).map(
      (row) => (row?.[0] as { value?: unknown })?.value ?? row?.[0],
    )
    expect(names.filter((name) => name === '上海')).toHaveLength(1)
    expect(a.doc.getMap('book').toJSON().sheets.sales.rows).toHaveLength(20)
  })

  it('adds, moves and removes sheets on both sides', async () => {
    const { a, b } = await pair()
    a.grid().transact((tr) => tr.addSheet({ name: '汇总' }, 0))
    await flush()
    expect(b.book.value.sheets.map((sheet) => sheet.name)).toEqual(['汇总', '销售', '城市'])
    expect(b.book.value.sheets[0]!.id).toBe(a.book.value.sheets[0]!.id)
    b.grid().transact((tr) => tr.removeSheet('cities'))
    await flush()
    expect(a.book.value.sheets.map((sheet) => sheet.name)).toEqual(['汇总', '销售'])
  })

  it('undoes only this side’s changes', async () => {
    const { a, b } = await pair()
    a.grid().transact((tr) => tr.setValue('B2', 1))
    await flush()
    b.grid().transact((tr) => tr.setValue('B3', 2))
    await flush()
    expect(a.grid().canUndo).toBe(true)
    expect(a.grid().undo()).toBe(true)
    await flush()
    for (const side of [a, b]) {
      expect(cell(side.book.value, 0, 1, 1)).toBe(120)
      expect(cell(side.book.value, 0, 2, 1)).toBe(2)
    }
    expect(a.grid().redo()).toBe(true)
    await flush()
    expect(cell(b.book.value, 0, 1, 1)).toBe(1)
  })

  it('undoes a row removal with its cells and sizes', async () => {
    const { a, b } = await pair()
    a.grid().transact((tr) => tr.setSize('row', 2, 40))
    a.grid().transact((tr) => tr.deleteRows('3'))
    await flush()
    expect(cell(b.book.value, 0, 2, 0)).toBe('南京')
    a.grid().undo()
    await flush()
    for (const side of [a, b]) {
      expect(cell(side.book.value, 0, 2, 0)).toBe('杭州')
      expect(side.book.value.sheets[0]!.rowSizes).toEqual({ 2: 40 })
      expect(cell(side.book.value, 0, 4, 1)).toBe('=SUM(B2:B4)')
    }
  })

  it('keeps an open edit on its cell when the other side inserts rows above it', async () => {
    const { a, b } = await pair()
    b.grid().edit('B3')
    const input = b.wrapper.find<HTMLTextAreaElement>('.dou-sheet__input')
    input.element.value = '81'
    await input.trigger('input')
    a.grid().transact((tr) => tr.insertRows(0, 2))
    await flush()
    await input.trigger('keydown', { key: 'Enter' })
    await flush()
    for (const side of [a, b]) {
      expect(cell(side.book.value, 0, 4, 0)).toBe('杭州')
      expect(cell(side.book.value, 0, 4, 1)).toBe(81)
    }
  })

  it('shows others’ changes in a read-only grid', async () => {
    const { a, b } = await pair({ readonly: true })
    a.grid().transact((tr) => tr.setValue('B2', 99))
    await flush()
    expect(cell(b.book.value, 0, 1, 1)).toBe(99)
  })

  it('shows what the others have selected, with their names', async () => {
    // the grid draws only what is in its viewport, which has no size without a layout
    const size = { clientWidth: 960, clientHeight: 480 }
    const spies = Object.entries(size).map(([key, value]) =>
      vi.spyOn(HTMLElement.prototype, key as keyof typeof size, 'get').mockReturnValue(value),
    )
    onTestFinished(() => spies.forEach((spy) => spy.mockRestore()))
    const { a, b } = await pair({ awareness: true })
    b.grid().select('B2:C3')
    await flush()
    const range = a.wrapper.find('.dou-sheet__peer-range')
    expect(range.exists()).toBe(true)
    expect(a.wrapper.find('.dou-sheet__peer-name').text()).toBe('阿青')
    // the others' cells follow rows inserted above them
    const top = () =>
      Number.parseFloat(
        a.wrapper.find('.dou-sheet__peer-range').attributes('style')!.split('top:')[1]!,
      )
    const before = top()
    a.grid().transact((tr) => tr.insertRows(0))
    await flush()
    expect(top()).toBe(before + 28)
    b.grid().edit('B2')
    await flush()
    expect(a.wrapper.find('.dou-sheet__peer-cell').classes()).toContain('is-editing')
  })
})
