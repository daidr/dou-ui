import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouSheet, formatRange, type SheetSelection, type SheetWorkbook } from '../index'
import type { SheetExpose } from '../types'

const sample = (): SheetWorkbook => ({
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      name: '库存',
      cells: [
        [
          { value: '物品', style: 'head' },
          { value: '数量', style: 'head' },
        ],
        ['显示器', 42],
        ['键盘', { value: 1200, format: '#,##0' }],
      ],
    },
  ],
})

function setup(extra: Record<string, unknown> = {}) {
  const book = ref(sample())
  const selection = ref<SheetSelection | undefined>()
  const grid = ref<SheetExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouSheet, {
          ref: grid,
          modelValue: book.value,
          'onUpdate:modelValue': (value: SheetWorkbook) => (book.value = value),
          selection: selection.value,
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
  const type = async (text: string) => {
    input.value += text
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
  }
  const cells = () => book.value.sheets[0]!.cells
  return { wrapper, book, selection, grid, input, key, type, cells }
}

const selected = (selection: SheetSelection | undefined) =>
  selection?.ranges.map((range) => formatRange(range)).join(',')

describe('DouSheet', () => {
  it('draws the cells with their formats and styles', () => {
    const { wrapper } = setup()
    const texts = wrapper.findAll('.dou-sheet__cell').map((cell) => cell.text())
    expect(texts.slice(0, 2)).toEqual(['物品', '数量'])
    expect(texts).toContain('1,200')
    const head = wrapper.findAll('.dou-sheet__cell')[0]!
    expect(head.classes()).toContain('is-bold')
    expect(head.classes()).toContain('is-fill-neutral')
    const number = wrapper.findAll('.dou-sheet__cell').find((cell) => cell.text() === '42')!
    expect(number.classes()).toContain('is-align-right')
    expect(wrapper.find('[role="grid"]').attributes('aria-rowcount')).toBe('1001')
    expect(wrapper.find('.dou-sheet__col-head').text()).toBe('A')
  })

  it('moves and extends the selection with keys', async () => {
    const { key, selection } = setup()
    await key('ArrowDown')
    await key('ArrowRight')
    expect(selection.value?.active).toEqual({ row: 1, col: 1 })
    await key('ArrowDown', { shiftKey: true })
    expect(selected(selection.value)).toBe('B2:B3')
    await key('ArrowUp', { ctrlKey: true })
    expect(selection.value?.active).toEqual({ row: 0, col: 1 })
    await key('ArrowDown', { ctrlKey: true })
    expect(selection.value?.active).toEqual({ row: 2, col: 1 })
    await key('a', { ctrlKey: true })
    expect(selected(selection.value)).toBe('A1:Z1000')
  })

  it('edits by typing, and Enter writes and moves down', async () => {
    const { key, type, cells, selection, wrapper } = setup()
    await key('ArrowDown')
    await key('ArrowDown')
    await key('ArrowRight')
    await type('1,500')
    expect(wrapper.find('textarea').classes()).toContain('is-open')
    await key('Enter')
    // the format is kept
    expect(cells()[2]![1]).toEqual({ value: 1500, format: '#,##0' })
    expect(selection.value?.active).toEqual({ row: 3, col: 1 })
    expect(wrapper.find('textarea').classes()).not.toContain('is-open')
  })

  it('reads typed percentages and keeps text that looks like a number', async () => {
    const { key, type, cells } = setup()
    await key('ArrowDown', { ctrlKey: true })
    await key('ArrowDown')
    await type('12.5%')
    await key('Tab')
    await type("'007")
    await key('Enter')
    expect(cells()[3]).toEqual([{ value: 0.125, format: '0.0%' }, '007'])
  })

  it('cancels with Escape and edits the value with F2', async () => {
    const { key, type, cells, input } = setup()
    await key('ArrowDown')
    await type('改了')
    await key('Escape')
    expect(cells()[1]![0]).toBe('显示器')
    await key('F2')
    expect(input.value).toBe('显示器')
    // in F2 mode the arrows move the caret instead of leaving
    await key('ArrowLeft')
    await type('（旧）')
    await key('Enter')
    expect(cells()[1]![0]).toBe('显示器（旧）')
  })

  it('clears the selection with Delete and undoes it', async () => {
    const { key, cells, grid } = setup()
    await key('ArrowDown')
    await key('ArrowDown', { shiftKey: true })
    await key('ArrowRight', { shiftKey: true })
    await key('Delete')
    expect(cells()[1]).toEqual([undefined, undefined])
    expect(cells()[2]).toEqual([undefined, { format: '#,##0' }])
    await key('z', { ctrlKey: true })
    expect(cells()[2]![1]).toEqual({ value: 1200, format: '#,##0' })
    expect(grid.value!.redo()).toBe(true)
    await nextTick()
    expect(cells()[1]).toEqual([undefined, undefined])
  })

  it('changes nothing when read-only', async () => {
    const { key, type, cells, grid } = setup({ readonly: true })
    await key('ArrowDown')
    await type('x')
    await key('Enter')
    await key('Delete')
    expect(cells()[1]![0]).toBe('显示器')
    expect(grid.value!.transact((tr) => tr.setValue('A1', 'x'))).toBeNull()
  })

  it('applies transactions and selects by name', async () => {
    const { grid, cells, selection } = setup()
    grid.value!.transact((tr) => tr.setValue('A5', '鼠标').setValue('B5', 98))
    await nextTick()
    expect(cells()[4]).toEqual(['鼠标', 98])
    grid.value!.select('B2:A3')
    await nextTick()
    expect(selected(selection.value)).toBe('A2:B3')
    expect(selection.value?.active).toEqual({ row: 1, col: 1 })
  })

  it('selects whole columns and rows by name', async () => {
    const { grid, selection, wrapper } = setup()
    grid.value!.select('B:B')
    await nextTick()
    expect(selection.value?.ranges[0]).toEqual({
      start: { row: 0, col: 1 },
      end: { row: 999, col: 1 },
    })
    expect(wrapper.find('.dou-sheet__col-head.is-full').text()).toBe('B')
    grid.value!.select('2:3')
    await nextTick()
    expect(selection.value?.ranges[0]!.end).toEqual({ row: 2, col: 25 })
  })

  it('writes to a sheet by name and keeps typed dates as typed', async () => {
    const { grid, key, type, cells, wrapper } = setup()
    grid.value!.transact((tr) => tr.setValue("'库存'!C1", '入库'))
    await nextTick()
    expect(cells()[0]![2]).toBe('入库')
    await key('ArrowDown')
    await key('ArrowRight', { ctrlKey: true })
    await key('ArrowRight')
    await type('2026/3/5')
    await key('Enter')
    expect(cells()[1]![2]).toEqual({ value: '2026-03-05', format: 'yyyy/m/d' })
    expect(wrapper.findAll('.dou-sheet__cell').map((cell) => cell.text())).toContain('2026/3/5')
  })

  it('copies and pastes through clipboard events', async () => {
    const { key, cells, input } = setup()
    await key('ArrowDown')
    await key('ArrowRight', { shiftKey: true })
    const data = new Map<string, string>()
    const clipboardData = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? '',
    }
    const fire = async (type: string) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'clipboardData', { value: clipboardData })
      input.dispatchEvent(event)
      await nextTick()
      return event
    }
    await fire('copy')
    expect(data.get('text/plain')).toBe('显示器\t42')
    await key('ArrowDown', { ctrlKey: true })
    await key('ArrowDown')
    await fire('paste')
    expect(cells()[3]).toEqual(['显示器', 42])
    // text from elsewhere is read as typed
    data.clear()
    data.set('text/plain', '鼠标\t1,500\n键盘\t12%')
    await fire('paste')
    expect(cells()[3]).toEqual(['鼠标', 1500])
    expect(cells()[4]).toEqual(['键盘', { value: 0.12, format: '0%' }])
  })

  it('cuts and moves cells', async () => {
    const { key, cells, input } = setup()
    const data = new Map<string, string>()
    const clipboardData = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? '',
    }
    const fire = async (type: string) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'clipboardData', { value: clipboardData })
      input.dispatchEvent(event)
      await nextTick()
    }
    await key('ArrowDown')
    await fire('cut')
    await key('ArrowRight', { ctrlKey: true })
    await key('ArrowRight')
    await fire('paste')
    expect(cells()[1]).toEqual([undefined, 42, '显示器'])
  })

  it('fills down with Ctrl+D and inserts rows with the keyboard', async () => {
    const { key, cells } = setup()
    await key('ArrowDown')
    await key('ArrowDown', { shiftKey: true })
    await key('ArrowDown', { shiftKey: true })
    await key('ArrowRight', { shiftKey: true })
    await key('d', { ctrlKey: true })
    expect(cells()[3]).toEqual(['显示器', 42])
    await key(' ', { shiftKey: true })
    await key('+', { ctrlKey: true, shiftKey: true })
    expect(cells()[1]).toBeNull()
    expect(cells()[4]).toEqual(['显示器', 42])
    await key('-', { ctrlKey: true })
    expect(cells()[1]).toEqual(['显示器', 42])
  })

  it('keeps frozen rows and columns at the top and left', () => {
    const book = sample()
    book.sheets[0]!.freeze = { rows: 1, cols: 1 }
    const frozen = mount(DouSheet, { props: { modelValue: book } })
    expect(frozen.findAll('.dou-sheet__head .dou-sheet__row')).toHaveLength(2)
    expect(frozen.findAll('.dou-sheet__body .dou-sheet__cell.is-frozen').length).toBeGreaterThan(0)
    expect(frozen.find('.dou-sheet__cell.is-freeze-edge').exists()).toBe(true)
  })
})
