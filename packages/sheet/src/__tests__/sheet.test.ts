import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  defineSheetCellType,
  defineSheetExtension,
  DouSheet,
  formatRange,
  useSheet,
  type SheetSelection,
  type SheetWorkbook,
} from '../index'
import type { SheetTransaction } from '../core/transaction'
import type { SheetExpose, SheetMenuContext, SheetMenuItem, SheetPasteEvent } from '../types'

const sample = (): SheetWorkbook => ({
  version: 1,
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

  it('lets no one change it when read-only, but still takes changes from code', async () => {
    const { key, type, cells, grid } = setup({ readonly: true })
    await key('ArrowDown')
    await type('x')
    await key('Enter')
    await key('Delete')
    expect(cells()[1]![0]).toBe('显示器')
    expect(grid.value!.transact((tr) => tr.setValue('A2', '键盘')).changed).toBe(true)
    await nextTick()
    expect(cells()[1]![0]).toBe('键盘')
    // the keys don't undo it; code does
    await key('z', { ctrlKey: true })
    expect(cells()[1]![0]).toBe('键盘')
    expect(grid.value!.undo()).toBe(true)
    await nextTick()
    expect(cells()[1]![0]).toBe('显示器')
    expect(grid.value!.redo()).toBe(true)
    await nextTick()
    expect(cells()[1]![0]).toBe('键盘')
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

  it('lets the paste event change or stop the paste, and says what made each change', async () => {
    const actions: (string | undefined)[] = []
    const { grid, cells } = setup({
      onPaste: (event: SheetPasteEvent) => {
        if (event.clip.cells[0]![0] === '停') return event.preventDefault()
        event.clip = { cells: [[String(event.clip.cells[0]![0]).toUpperCase()]] }
      },
      onTransaction: (tr: SheetTransaction) => actions.push(tr.meta.action),
    })
    grid.value!.select('C1')
    grid.value!.paste({ cells: [['abc']] })
    await nextTick()
    expect(cells()[0]![2]).toBe('ABC')
    grid.value!.paste({ cells: [['停']] })
    await nextTick()
    expect(cells()[0]![2]).toBe('ABC')
    grid.value!.undo()
    grid.value!.transact((tr) => tr.setValue('D1', 1))
    expect(actions).toEqual(['paste', 'undo', 'api'])
  })

  it('offers column operations for whole columns, and lets the menu be changed', async () => {
    const seen: { keys: string[]; area: string }[] = []
    const { grid, key } = setup({
      menu: (items: SheetMenuItem[], context: SheetMenuContext) => {
        seen.push({ keys: items.map((item) => item.key), area: context.area })
        return items.filter((item) => item.key !== 'cut')
      },
    })
    grid.value!.select('B:B')
    await nextTick()
    await key('F10', { shiftKey: true })
    expect(seen[0]!.area).toBe('col')
    expect(seen[0]!.keys).toContain('col-left')
    expect(seen[0]!.keys).not.toContain('row-above')
    grid.value!.select('A1')
    await nextTick()
    await key('F10', { shiftKey: true })
    expect(seen[1]!.area).toBe('cell')
    expect(seen[1]!.keys).toEqual([
      'cut',
      'copy',
      'paste',
      'insert',
      'delete',
      'group',
      'note',
      'link',
      'sort',
      'filter',
      'lock',
      'clear',
    ])
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
  it('draws merged cells once and grows the selection over them', async () => {
    const book = sample()
    book.sheets[0]!.merges = ['A1:B1']
    const { wrapper, key, selection } = setup({ modelValue: book })
    const merged = wrapper.findAll('.dou-sheet__cell.is-merged')
    expect(merged).toHaveLength(1)
    expect(merged[0]!.text()).toBe('物品')
    expect(merged[0]!.attributes('style')).toContain('width: 192px')
    expect(wrapper.findAll('.dou-sheet__cell.is-covered')).toHaveLength(2)
    expect(selected(selection.value)).toBe('A1:B1')
    await key('ArrowRight')
    // out of the merge from its right edge
    expect(selection.value?.active).toEqual({ row: 0, col: 2 })
    await key('ArrowLeft')
    expect(selection.value?.active).toEqual({ row: 0, col: 0 })
  })
})

const typed = (): SheetWorkbook => ({
  version: 1,
  types: {
    status: { type: 'select', options: ['未开始', { value: '进行中', tone: 'primary' }, '已完成'] },
  },
  sheets: [
    {
      name: '任务',
      cells: [
        [
          { value: true, type: 'checkbox' },
          { value: '未开始', type: 'status' },
          { value: '2026-10-31 09:30', type: 'date' },
        ],
        [
          { value: false, type: 'checkbox' },
          { value: '进行中', type: 'status' },
        ],
      ],
    },
  ],
})

describe('DouSheet cell types', () => {
  it('draws check boxes and tags, and switches boxes with Space and a click', async () => {
    const { wrapper, key, book, grid } = setup({ modelValue: typed() })
    expect(wrapper.findAll('.dou-sheet__check')).toHaveLength(2)
    expect(wrapper.find('.dou-sheet__check').classes()).toContain('is-checked')
    expect(wrapper.find('.dou-tag--primary').text()).toBe('进行中')
    // an option without a tone is a neutral tag
    expect(wrapper.findAll('.dou-sheet__tag').map((el) => el.text())).toEqual(['未开始', '进行中'])
    // boxes that differ are all checked; boxes that agree all switch
    grid.value!.select('A1:A2')
    await nextTick()
    const checks = () =>
      book.value.sheets[0]!.cells.map((row) => (row![0] as { value: boolean }).value)
    await key(' ')
    expect(checks()).toEqual([true, true])
    await key(' ')
    expect(checks()).toEqual([false, false])
    await wrapper.findAll('.dou-sheet__check')[1]!.trigger('click')
    expect((book.value.sheets[0]!.cells[1]![0] as { value: boolean }).value).toBe(true)
    // screen readers read the box's state
    const read = wrapper.findAll('.is-type-checkbox .dou-sheet__sr-only').map((el) => el.text())
    expect(read).toEqual(['未勾选', '已勾选'])
    // F2 switches instead of opening the editor
    grid.value!.select('A2')
    await nextTick()
    await key('F2')
    expect((book.value.sheets[0]!.cells[1]![0] as { value: boolean }).value).toBe(false)
    expect(wrapper.find('.dou-sheet__input.is-open').exists()).toBe(false)
  })

  it('picks an option from the list with the keys, and reads typed options', async () => {
    const { wrapper, key, type, book, grid } = setup({ modelValue: typed() })
    grid.value!.select('B1')
    await nextTick()
    await key('ArrowDown', { altKey: true })
    await nextTick()
    const options = document.querySelectorAll('.dou-sheet__option')
    expect([...options].map((o) => o.textContent?.trim())).toEqual(['未开始', '进行中', '已完成'])
    await key('ArrowDown')
    await key('Enter')
    expect(book.value.sheets[0]!.cells[0]![1]).toEqual({ value: '进行中', type: 'status' })
    expect(document.querySelector('.dou-sheet__options')).toBeNull()
    // typing filters; text naming an option in another case is that option
    grid.value!.select('B2')
    await nextTick()
    await type('已')
    expect(
      [...document.querySelectorAll('.dou-sheet__option')].map((o) => o.textContent?.trim()),
    ).toEqual(['已完成'])
    await key('Enter')
    expect(book.value.sheets[0]!.cells[1]![1]).toEqual({ value: '已完成', type: 'status' })
    wrapper.unmount()
  })

  it('opens a calendar for dates and keeps the time when a day is picked', async () => {
    const { wrapper, key, book, grid } = setup({ modelValue: typed() })
    grid.value!.select('C1')
    await nextTick()
    await key('F2')
    await nextTick()
    const days = [...document.querySelectorAll<HTMLElement>('.dou-sheet__calendar [data-value]')]
    const day = days.find((el) => el.dataset.value === '2026-10-20')
    expect(day).toBeTruthy()
    day!.click()
    await nextTick()
    expect(book.value.sheets[0]!.cells[0]![2]).toEqual({ value: '2026-10-20 09:30', type: 'date' })
    wrapper.unmount()
  })
})

describe('DouSheet extensions', () => {
  it('adds cell types, keys, menu items, overlays and a say in each change', async () => {
    const calls: string[] = []
    const Overlay = defineComponent(() => {
      const sheet = useSheet()
      return () => h('div', { class: 'test-overlay' }, sheet.sheet.value.name)
    })
    const stars = defineSheetCellType({
      name: 'stars',
      parse: (text) => ({ value: text.length }),
      format: (value) => '★'.repeat(Number(value) || 0),
    })
    const extension = defineSheetExtension({
      name: 'test',
      cellTypes: [stars],
      keymap: (context) => ({
        'mod+b': () => {
          calls.push(
            `key ${formatRange({ start: context.active.value, end: context.active.value })}`,
          )
        },
      }),
      contextMenu: () => [{ key: 'mine', label: '我的', run: () => calls.push('menu') }],
      overlays: [Overlay],
      setup: () => {
        calls.push('setup')
        return () => calls.push('cleanup')
      },
      // every change gets a note in A9
      transaction: (tr) => {
        if (tr.meta.action !== 'api') tr.setCell('A9', 'changed')
      },
    })
    const menuKeys: string[][] = []
    const book = sample()
    book.sheets[0]!.cells.push([{ value: 2, type: 'stars' }])
    const { wrapper, key, type, cells, grid } = setup({
      modelValue: book,
      extensions: [extension],
      menu: (items: SheetMenuItem[]) => {
        menuKeys.push(items.map((item) => item.key))
        return items
      },
    })
    expect(calls).toEqual(['setup'])
    expect(wrapper.find('.test-overlay').text()).toBe('库存')
    expect(wrapper.findAll('.dou-sheet__cell').some((cell) => cell.text() === '★★')).toBe(true)
    await key('b', { ctrlKey: true })
    expect(calls).toContain('key A1')
    await key('F10', { shiftKey: true })
    expect(menuKeys[0]!.slice(0, 2)).toEqual(['mine', 'cut'])
    grid.value!.select('A4')
    await nextTick()
    await type('abc')
    await key('Enter')
    expect(cells()[3]).toEqual([{ value: 3, type: 'stars' }])
    expect(cells()[8]).toEqual(['changed'])
    // undo takes back the added step with the rest
    grid.value!.undo()
    await nextTick()
    expect(cells()[8]?.[0]).toBeUndefined()
    wrapper.unmount()
    expect(calls).toContain('cleanup')
  })
})

describe('DouSheet review fixes', () => {
  it('reads more ways to write a day, and marks values that do not fit', async () => {
    const { wrapper, type, key, book, grid } = setup({ modelValue: typed() })
    const year = new Date().getFullYear()
    grid.value!.select('C1')
    await nextTick()
    await type('11月30日')
    await key('Enter')
    expect(book.value.sheets[0]!.cells[0]![2]).toEqual({ value: `${year}-11-30`, type: 'date' })
    grid.value!.transact((tr) => {
      tr.updateCell('C1', { value: '明天' })
      tr.updateCell('B2', { value: '取消了' })
    })
    await nextTick()
    const invalid = wrapper
      .findAll('.dou-sheet__cell.is-invalid')
      .map((cell) => cell.find('.dou-sheet__text').text())
    expect(invalid).toEqual(['明天', '取消了'])
    const marked = wrapper.findAll('.dou-sheet__cell.is-invalid')
    expect(marked.map((cell) => cell.attributes('title'))).toEqual(['不是日期', '不在选项里'])
    expect(marked[1]!.findAll('.dou-sheet__sr-only').map((el) => el.text())).toEqual([
      '取消了',
      '（不在选项里）',
    ])
    // what a type draws is hidden from screen readers; only the label is read
    const shown = marked[1]!.find('.dou-sheet__content')
    expect(shown.attributes('aria-hidden')).toBe('true')
    wrapper.unmount()
  })

  it('edits a custom type with the text it shows, and copies that text', async () => {
    const percent = defineSheetExtension({
      name: 'percent',
      cellTypes: [
        defineSheetCellType({
          name: 'percent',
          parse: (text) => ({ value: Number.parseFloat(text) / 100 }),
          format: (value) => (typeof value === 'number' ? `${value * 100}%` : undefined),
        }),
      ],
    })
    const book = sample()
    book.sheets[0]!.cells.push([{ value: 0.8, type: 'percent' }])
    const { input, key, cells, grid, wrapper } = setup({ modelValue: book, extensions: [percent] })
    grid.value!.select('A4')
    await nextTick()
    await key('F2')
    expect(input.value).toBe('80%')
    await key('Enter')
    expect(cells()[3]).toEqual([{ value: 0.8, type: 'percent' }])
    const data = new Map<string, string>()
    const event = new Event('copy', { bubbles: true, cancelable: true }) as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', {
      value: { setData: (k: string, v: string) => data.set(k, v), getData: () => '' },
    })
    grid.value!.select('A4')
    await nextTick()
    input.dispatchEvent(event)
    expect(data.get('text/plain')).toBe('80%')
    wrapper.unmount()
  })

  it('tells screen readers how merged cells span, and hides the cells under them', () => {
    const book = sample()
    book.sheets[0]!.merges = ['A2:B3']
    const { wrapper } = setup({ modelValue: book })
    const merged = wrapper.find('.dou-sheet__cell.is-merged')
    expect(merged.attributes('aria-rowspan')).toBe('2')
    expect(merged.attributes('aria-colspan')).toBe('2')
    const covered = wrapper.findAll('.dou-sheet__cell.is-covered')
    expect(covered.length).toBe(4)
    expect(covered.every((cell) => cell.attributes('aria-hidden') === 'true')).toBe(true)
  })

  it('keeps the covered values when asked, and the context walks the selection', async () => {
    const seen: string[] = []
    const probe = defineSheetExtension({
      name: 'probe',
      keymap: ({ forEachSelected }) => ({
        'mod+b': () => forEachSelected((p) => seen.push(formatRange({ start: p, end: p }))),
      }),
    })
    const book = sample()
    book.sheets[0]!.merges = ['A2:B2']
    const { key, cells, grid, wrapper } = setup({ modelValue: book, extensions: [probe] })
    grid.value!.select('A1:B2')
    await nextTick()
    await key('b', { ctrlKey: true })
    expect(seen).toEqual(['A1', 'B1', 'A2'])
    grid.value!.transact((tr) => tr.mergeCells('A3:B3', { keep: true }))
    await nextTick()
    expect(cells()[2]).toEqual(['键盘', { value: 1200, format: '#,##0' }])
    wrapper.unmount()
  })
})

describe('text starting with =', () => {
  it("keeps '= as text, shown without the mark and edited with it", async () => {
    const { wrapper, grid, type, key, cells, input } = setup()
    grid.value!.select('C1')
    await nextTick()
    await type("'=abc")
    await key('Enter')
    expect(cells()[0]![2]).toBe("'=abc")
    expect(wrapper.findAll('.dou-sheet__cell').some((cell) => cell.text() === '=abc')).toBe(true)
    grid.value!.edit('C1')
    await nextTick()
    expect(input.value).toBe("'=abc")
    wrapper.unmount()
  })
})
