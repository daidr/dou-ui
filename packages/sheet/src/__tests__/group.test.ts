import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouSheet } from '../index'
import type { SheetSelection } from '../core/selection'
import type { SheetExpose } from '../types'
import { groupButtonLine, groupsOf, groupSpan, SheetGroups } from '../core/group'
import type { SheetGroup, SheetWorkbook } from '../core/model'
import { applySheetSteps, SheetTransaction } from '../core/transaction'

const plainBook = (groups?: SheetGroup[]): SheetWorkbook => ({
  sheets: [{ name: '表 1', cells: [], groups }],
})

const groupsAfter = (tr: SheetTransaction) => tr.doc.sheets[0]!.groups
const ranges = (tr: SheetTransaction) => groupsAfter(tr)?.map((g) => g.range)

describe('groups', () => {
  it('reads whole rows and whole columns only', () => {
    expect(groupSpan('3:8')).toEqual({ axis: 'row', start: 2, end: 7 })
    expect(groupSpan('B:D')).toEqual({ axis: 'col', start: 1, end: 3 })
    expect(groupSpan('A1:B2')).toBeNull()
    expect(groupSpan('nope')).toBeNull()
  })

  it('nests groups and leaves out those that cross or nest too deep', () => {
    const laid = new SheetGroups([
      { range: '2:10' },
      { range: '4:5', collapsed: true },
      { range: '7:12' },
      { range: 'B:C' },
      { range: '2:10' },
    ])
    expect(laid.rows.list.map((g) => [g.start, g.end, g.depth])).toEqual([
      [1, 9, 1],
      [3, 4, 2],
    ])
    expect(laid.rows.dropped).toBe(2)
    expect(laid.rows.depth).toBe(2)
    expect([...laid.rows.hidden]).toEqual([3, 4])
    expect(laid.cols.list).toHaveLength(1)
    const deep = new SheetGroups(
      Array.from({ length: 9 }, (_, i) => ({ range: `${i + 1}:${20 - i}` })),
    )
    expect(deep.rows.depth).toBe(8)
    expect(deep.rows.dropped).toBe(1)
  })

  it('puts the button on the line before the group, or after it at the top', () => {
    expect(groupButtonLine({ start: 2, end: 5 }, 100)).toBe(1)
    expect(groupButtonLine({ start: 0, end: 5 }, 100)).toBe(6)
    expect(groupButtonLine({ start: 0, end: 99 }, 100)).toBe(-1)
  })

  it('groups, collapses and ungroups, and undoes it', () => {
    const doc = plainBook()
    const tr = new SheetTransaction(doc).groupRows('3:8').groupRows(4, 2).groupCols('B:C')
    expect(ranges(tr)).toEqual(['3:8', '5:6', 'B:C'])
    // the same lines again change nothing
    expect(new SheetTransaction(tr.doc).groupRows('3:8').changed).toBe(false)
    expect(() => new SheetTransaction(tr.doc).groupRows('6:10')).toThrow(RangeError)

    const folded = new SheetTransaction(tr.doc).collapseGroup('3:8')
    expect(groupsAfter(folded)![0]).toEqual({ range: '3:8', collapsed: true })
    expect([...groupsOf(folded.doc.sheets[0]!).rows.hidden]).toEqual([2, 3, 4, 5, 6, 7])
    expect(groupsAfter(new SheetTransaction(folded.doc).expandGroup('3:8'))![0]).toEqual({
      range: '3:8',
      collapsed: false,
    })
    expect(() => new SheetTransaction(tr.doc).collapseGroup('3:9')).toThrow(RangeError)

    expect(applySheetSteps(tr.doc, tr.inverse).doc.sheets[0]!.groups).toBeUndefined()
    expect(applySheetSteps(doc, tr.steps).doc.sheets[0]!.groups).toEqual(groupsAfter(tr))
  })

  it('ungroups the outer groups within the lines, or takes the lines out of a group', () => {
    const doc = plainBook([{ range: '3:8' }, { range: '5:6' }, { range: '10:20', collapsed: true }])
    expect(ranges(new SheetTransaction(doc).ungroupRows('3:8'))).toEqual(['5:6', '10:20'])
    expect(ranges(new SheetTransaction(doc).ungroupRows('5:6'))).toEqual(['3:8', '10:20'])
    // one level at a time: the outer groups go first
    expect(ranges(new SheetTransaction(doc).ungroupRows('1:30'))).toEqual(['5:6'])
    // splits the group, keeping it folded
    const split = new SheetTransaction(doc).ungroupRows('14:15')
    expect(groupsAfter(split)).toEqual([
      { range: '3:8' },
      { range: '5:6' },
      { range: '10:13', collapsed: true },
      { range: '16:20', collapsed: true },
    ])
    // the deepest group touched loses the lines
    expect(ranges(new SheetTransaction(doc).ungroupRows('6:7'))).toEqual(['3:8', '5:5', '10:20'])
    expect(new SheetTransaction(doc).ungroupRows('25:30').changed).toBe(false)
  })

  it('shows groups down to a level', () => {
    const doc = plainBook([{ range: '3:8' }, { range: '5:6' }, { range: 'B:C' }])
    const one = new SheetTransaction(doc).showGroupLevel('row', 1)
    expect(groupsAfter(one)!.map((g) => !!g.collapsed)).toEqual([true, true, false])
    const two = new SheetTransaction(one.doc).showGroupLevel('row', 2)
    expect(groupsAfter(two)!.map((g) => !!g.collapsed)).toEqual([false, true, false])
    const all = new SheetTransaction(two.doc).showGroupLevel('row', 3)
    expect(groupsAfter(all)!.map((g) => !!g.collapsed)).toEqual([false, false, false])
    expect(new SheetTransaction(all.doc).showGroupLevel('row', 3).changed).toBe(false)
  })

  it('moves groups with their lines', () => {
    const doc = plainBook([{ range: '3:8' }, { range: 'B:C' }, { range: '10:10' }])
    expect(ranges(new SheetTransaction(doc).insertRows(4, 2))).toEqual(['3:10', 'B:C', '12:12'])
    // rows inserted at the top of a group go before it
    expect(ranges(new SheetTransaction(doc).insertRows(2))).toEqual(['4:9', 'B:C', '11:11'])
    expect(ranges(new SheetTransaction(doc).deleteRows('10'))).toEqual(['3:8', 'B:C'])
    expect(ranges(new SheetTransaction(doc).deleteRows('1:4'))).toEqual(['1:4', 'B:C', '6:6'])
    expect(ranges(new SheetTransaction(doc).insertCols('A'))).toEqual(['3:8', 'C:D', '10:10'])
    expect(ranges(new SheetTransaction(doc).moveRows('10', '1'))).toEqual(['4:9', 'B:C', '1:1'])
  })
})

const report = (): SheetWorkbook => ({
  sheets: [
    {
      name: '门店',
      // the first group's button is on a frozen row, drawn once
      freeze: { rows: 1 },
      cells: [
        ['华东', 300],
        ['上海', 120],
        ['杭州', 100],
        ['南京', 80],
        ['华南', 200],
        ['广州', 120],
        ['深圳', 80],
      ],
      groups: [{ range: '2:4' }, { range: '6:7', collapsed: true }],
    },
  ],
})

function setup(extra: Record<string, unknown> = {}) {
  const book = ref(report())
  const selection = ref<SheetSelection>()
  const grid = ref<SheetExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouSheet, {
          ref: grid,
          modelValue: book.value,
          'onUpdate:modelValue': (value: SheetWorkbook) => (book.value = value),
          'onUpdate:selection': (value: SheetSelection) => (selection.value = value),
          ...extra,
        }),
    ),
    { attachTo: document.body },
  )
  const input = wrapper.find('textarea').element as HTMLTextAreaElement
  const key = async (name: string, init: KeyboardEventInit = {}) => {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }),
    )
    await nextTick()
  }
  const buttons = () =>
    wrapper.findAll('.dou-sheet__outline-button:not(.is-level)').map((b) => ({
      label: b.attributes('aria-label'),
      expanded: b.attributes('aria-expanded'),
    }))
  const rowShown = (row: number) =>
    wrapper.findAll('[role="rowheader"]').some((head) => head.text() === String(row))
  return { wrapper, book, grid, selection, key, buttons, rowShown }
}

describe('DouSheet groups', () => {
  it('draws the outline and folds a group from its button', async () => {
    const { wrapper, book, grid, selection, buttons, rowShown } = setup()
    await nextTick()
    expect(buttons()).toEqual([
      { label: '折叠第 2–4 行', expanded: 'true' },
      { label: '展开第 6–7 行', expanded: 'false' },
    ])
    expect(wrapper.find('.dou-sheet__outline.is-row').attributes('style')).toContain('width: 32px')
    expect(wrapper.find('.dou-sheet__outline.is-col').exists()).toBe(false)
    expect(rowShown(6)).toBe(false)

    grid.value!.select('A3')
    await nextTick()
    await wrapper.find('.dou-sheet__outline-button[aria-expanded="true"]').trigger('click')
    expect(book.value.sheets[0]!.groups![0]).toEqual({ range: '2:4', collapsed: true })
    expect(rowShown(3)).toBe(false)
    // the active cell moved off the folded rows
    expect(selection.value!.active).toEqual({ row: 0, col: 0 })
    grid.value!.undo()
    await nextTick()
    expect(rowShown(3)).toBe(true)

    // level 1 folds every group, level 2 shows them all
    const levels = wrapper.findAll('.dou-sheet__outline-button.is-level')
    expect(levels.map((b) => b.text())).toEqual(['1', '2'])
    await levels[1]!.trigger('click')
    expect(book.value.sheets[0]!.groups!.map((g) => !!g.collapsed)).toEqual([false, false])
    expect(grid.value!.exportSVG()).toContain('深圳')
    wrapper.unmount()
  })

  it('groups with the keys and the menu', async () => {
    const { wrapper, book, grid, key } = setup()
    grid.value!.select('A:C')
    await nextTick()
    await key('ArrowRight', { altKey: true, shiftKey: true })
    expect(book.value.sheets[0]!.groups!.at(-1)).toEqual({ range: 'A:C' })
    await nextTick()
    expect(wrapper.find('.dou-sheet__outline.is-col').exists()).toBe(true)
    await key('ArrowLeft', { altKey: true, shiftKey: true })
    expect(book.value.sheets[0]!.groups).toHaveLength(2)
    // crossing a group is refused, and said
    grid.value!.select('A3:B5')
    await nextTick()
    await key('ArrowRight', { altKey: true, shiftKey: true })
    expect(book.value.sheets[0]!.groups).toHaveLength(2)
    expect(wrapper.find('.dou-sheet__notice').text()).toContain('不能这样分组')
    wrapper.unmount()
  })

  it('folds for the view alone on a read-only grid', async () => {
    const { wrapper, book, grid, buttons } = setup({ readonly: true })
    await nextTick()
    await wrapper.find('.dou-sheet__outline-button[aria-expanded="false"]').trigger('click')
    expect(buttons()[1]!.expanded).toBe('true')
    expect(grid.value!.exportSVG()).toContain('深圳')
    expect(book.value.sheets[0]!.groups![1]).toEqual({ range: '6:7', collapsed: true })
    wrapper.unmount()
  })

  it('leaves folded rows out of images', async () => {
    const { wrapper, grid } = setup()
    await nextTick()
    const svg = grid.value!.exportSVG()
    expect(svg).toContain('华南')
    expect(svg).not.toContain('广州')
    wrapper.unmount()
  })
})
