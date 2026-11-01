import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  defineSheetExtension,
  DouSheet,
  useSheet,
  type SheetContext,
  type SheetExpose,
  type SheetSelection,
  type SheetWorkbook,
} from '../index'
import { cellMatcher, foundFrom, replaceInText } from '../core/find'

const book = (): SheetWorkbook => ({
  sheets: [
    {
      name: '采购',
      cells: [
        ['物品', '单价', '数量', '小计'],
        ['白板笔', 12, 3, '=B2*C2'],
        ['便签纸', 8, 10, '=B3*C3'],
        ['白板擦', 15, 2, '=B4*C4'],
        ['白板', 36, 1, '=B5*C5'],
      ],
      rowCount: 20,
      colCount: 6,
    },
    {
      name: '上海',
      cells: [['白板'], ['投影仪']],
      rowCount: 10,
      colCount: 4,
    },
  ],
})

function setup(props: Record<string, unknown> = {}) {
  const doc = ref(book())
  const selection = ref<SheetSelection>({
    active: { row: 0, col: 0 },
    ranges: [{ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }],
  })
  const sheet = ref<SheetExpose>()
  let context!: SheetContext
  const Probe = defineComponent(() => {
    context = useSheet()
    return () => null
  })
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(
          DouSheet,
          {
            ref: sheet,
            modelValue: doc.value,
            'onUpdate:modelValue': (value: SheetWorkbook) => (doc.value = value),
            selection: selection.value,
            'onUpdate:selection': (value: SheetSelection) => (selection.value = value),
            ...props,
          },
          { header: () => h(Probe) },
        ),
    ),
    { attachTo: document.body },
  )
  const grid = () => wrapper.find('[role="grid"]')
  const panel = () => wrapper.find('.dou-find-replace')
  const status = () => wrapper.find('.dou-find-replace__status').text()
  const inputs = () => wrapper.findAll<HTMLInputElement>('.dou-find-replace__input')
  const type = async (index: number, text: string) => {
    await inputs()[index]!.setValue(text)
    await nextTick()
  }
  const toggle = async (label: string) => {
    await wrapper.find(`.dou-find-replace [aria-label="${label}"]`).trigger('click')
    await nextTick()
  }
  const cells = (i = 0) => doc.value.sheets[i]!.cells
  return {
    wrapper,
    doc,
    selection,
    sheet: () => sheet.value!,
    grid,
    panel,
    status,
    inputs,
    type,
    toggle,
    cells,
    context: () => context,
  }
}

describe('finding text in cells', () => {
  it('matches by case and by the whole text', () => {
    expect(cellMatcher({ search: '' })).toBeNull()
    expect(cellMatcher({ search: 'ab' })!('xABy')).toBe(true)
    expect(cellMatcher({ search: 'ab', caseSensitive: true })!('xABy')).toBe(false)
    expect(cellMatcher({ search: 'ab', wholeCell: true })!('AB')).toBe(true)
    expect(cellMatcher({ search: 'ab', wholeCell: true })!('abc')).toBe(false)
  })

  it('replaces every match in a text, keeping `$` as typed', () => {
    expect(replaceInText('白板笔和白板', { search: '白板', replace: '$&黑' })).toBe('$&黑笔和$&黑')
    expect(replaceInText('Aa', { search: 'a', replace: 'b' })).toBe('bb')
    expect(replaceInText('Aa', { search: 'a', replace: 'b', caseSensitive: true })).toBe('Ab')
    expect(replaceInText('白板', { search: '白板', replace: '投影', wholeCell: true })).toBe('投影')
    expect(replaceInText('白板笔', { search: '白板', replace: 'x', wholeCell: true })).toBe(
      '白板笔',
    )
  })

  it('finds the next match from a place, wrapping round', () => {
    const list = [
      { sheet: 0, row: 1, col: 0 },
      { sheet: 0, row: 3, col: 2 },
      { sheet: 1, row: 0, col: 0 },
    ]
    expect(foundFrom(list, { sheet: 0, row: 0, col: 5 })).toBe(0)
    expect(foundFrom(list, { sheet: 0, row: 3, col: 2 })).toBe(1)
    expect(foundFrom(list, { sheet: 0, row: 3, col: 3 })).toBe(2)
    expect(foundFrom(list, { sheet: 1, row: 0, col: 1 })).toBe(0)
    expect(foundFrom([], { sheet: 0, row: 0, col: 0 })).toBe(-1)
  })
})

describe('the find panel', () => {
  it('opens with Ctrl+F, counts the matches and goes through them', async () => {
    const { wrapper, grid, panel, status, type, selection } = setup()
    await grid().trigger('keydown', { key: 'f', ctrlKey: true })
    expect(panel().exists()).toBe(true)
    await type(0, '白板')
    // the first match from the active cell on is selected as you type
    expect(selection.value.active).toEqual({ row: 1, col: 0 })
    expect(status()).toBe('1/3')
    await wrapper.find('.dou-find-replace__input').trigger('keydown', { key: 'Enter' })
    expect(selection.value.active).toEqual({ row: 3, col: 0 })
    await wrapper
      .find('.dou-find-replace__input')
      .trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(selection.value.active).toEqual({ row: 1, col: 0 })
    await wrapper.find('.dou-find-replace').trigger('keydown', { key: 'Escape' })
    expect(panel().exists()).toBe(false)
    // F3 goes on with the last search, the panel shut
    await grid().trigger('keydown', { key: 'F3' })
    expect(selection.value.active).toEqual({ row: 3, col: 0 })
    wrapper.unmount()
  })

  it('reads the values cells show, or the formulas with the toggle', async () => {
    const { wrapper, grid, status, type, toggle } = setup()
    await grid().trigger('keydown', { key: 'f', ctrlKey: true })
    // a price, and two subtotals worked out to 36
    await type(0, '36')
    expect(status()).toBe('1/3')
    await type(0, 'B2')
    expect(status()).toBe('无结果')
    await toggle('查找公式')
    expect(status()).toBe('1/1')
    wrapper.unmount()
  })

  it('matches whole cells, by case, and on every sheet', async () => {
    const { wrapper, grid, status, type, toggle, selection, context } = setup()
    await grid().trigger('keydown', { key: 'f', ctrlKey: true })
    await type(0, '白板')
    await toggle('单元格完全匹配')
    expect(status()).toBe('1/1')
    expect(selection.value.active).toEqual({ row: 4, col: 0 })
    await toggle('所有工作表')
    expect(status()).toBe('1/2')
    await wrapper.find('.dou-find-replace__input').trigger('keydown', { key: 'Enter' })
    await nextTick()
    await nextTick()
    // the match on the other sheet shows that sheet
    expect(context().sheetIndex.value).toBe(1)
    expect(selection.value.active).toEqual({ row: 0, col: 0 })
    wrapper.unmount()
  })

  it('replaces one at a time, then all as one step to undo', async () => {
    const { wrapper, grid, type, cells, selection, sheet } = setup()
    await grid().trigger('keydown', { key: 'h', ctrlKey: true })
    expect(wrapper.findAll('.dou-find-replace__input').length).toBe(2)
    await type(0, '白板')
    await type(1, '黑板')
    const replaceBox = () => wrapper.findAll('.dou-find-replace__input')[1]!
    await replaceBox().trigger('keydown', { key: 'Enter' })
    expect(cells()[1]![0]).toBe('黑板笔')
    expect(selection.value.active).toEqual({ row: 3, col: 0 })
    await replaceBox().trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(cells().map((r) => r![0])).toEqual(['物品', '黑板笔', '便签纸', '黑板擦', '黑板'])
    // the other sheet stays as it was
    expect(cells(1)[0]![0]).toBe('白板')
    sheet().undo()
    await nextTick()
    expect(cells().map((r) => r![0])).toEqual(['物品', '黑板笔', '便签纸', '白板擦', '白板'])
    wrapper.unmount()
  })

  it('leaves formula results, and replaces in formulas when looking there', async () => {
    const { wrapper, grid, type, toggle, cells } = setup()
    await grid().trigger('keydown', { key: 'h', ctrlKey: true })
    await type(0, '36')
    await type(1, '40')
    await wrapper.findAll('.dou-find-replace__input')[1]!.trigger('keydown', {
      key: 'Enter',
      ctrlKey: true,
    })
    // the price became a number again; the subtotals are formulas and stay
    expect(cells()[4]![1]).toBe(40)
    expect(cells()[1]![3]).toBe('=B2*C2')
    expect(wrapper.find('.dou-sheet__notice').text()).toContain('2 处是公式的结果')
    await toggle('查找公式')
    await type(0, 'C')
    await type(1, 'D')
    await wrapper.findAll('.dou-find-replace__input')[1]!.trigger('keydown', {
      key: 'Enter',
      ctrlKey: true,
    })
    expect(cells()[1]![3]).toBe('=B2*D2')
    wrapper.unmount()
  })

  it('replaces in the text a number format shows, keeping the format', async () => {
    const { wrapper, doc, grid, type, cells } = setup()
    doc.value.sheets[0]!.cells[1]![1] = { value: 12, format: '¥#,##0.00' }
    doc.value.sheets[0]!.cells[3]![1] = { value: 15, format: '¥#,##0.00' }
    await nextTick()
    await grid().trigger('keydown', { key: 'h', ctrlKey: true })
    await type(0, '¥1')
    await type(1, '$1')
    await wrapper.findAll('.dou-find-replace__input')[1]!.trigger('keydown', {
      key: 'Enter',
      ctrlKey: true,
    })
    // “$12.00” doesn't read back as a number, so the cells stay, and the notice says why
    expect(cells()[1]![1]).toEqual({ value: 12, format: '¥#,##0.00' })
    expect(wrapper.find('.dou-sheet__notice').text()).toContain('2 处查到的文字只在显示格式里')
    await type(0, '12.00')
    await type(1, '13.00')
    await wrapper.findAll('.dou-find-replace__input')[1]!.trigger('keydown', {
      key: 'Enter',
      ctrlKey: true,
    })
    expect(cells()[1]![1]).toEqual({ value: 13, format: '¥#,##0.00' })
    expect(cells()[3]![1]).toEqual({ value: 15, format: '¥#,##0.00' })
    wrapper.unmount()
  })

  it('waits for a pause in typing before searching a big workbook', async () => {
    vi.useFakeTimers()
    try {
      const { wrapper, doc, grid, status, type } = setup()
      doc.value.sheets[0]!.cells = Array.from({ length: 2000 }, (_, row) =>
        Array.from({ length: 12 }, (__, col) => (row === 1500 && col === 3 ? '上海' : row * col)),
      )
      doc.value.sheets[0]!.rowCount = 2000
      doc.value.sheets[0]!.colCount = 12
      await nextTick()
      await grid().trigger('keydown', { key: 'f', ctrlKey: true })
      await type(0, '上海')
      expect(status()).toBe('')
      vi.advanceTimersByTime(200)
      await nextTick()
      expect(status()).toBe('1/1')
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('opens and closes from code', async () => {
    const { wrapper, sheet, panel, inputs } = setup()
    expect(sheet().openSearch({ search: '白板', replace: '黑板' })).toBe(true)
    await nextTick()
    expect(inputs().map((i) => i.element.value)).toEqual(['白板', '黑板'])
    expect(sheet().closeSearch()).toBe(true)
    await nextTick()
    expect(panel().exists()).toBe(false)
    expect(sheet().closeSearch()).toBe(false)
    wrapper.unmount()
  })

  it('only finds on a read-only grid', async () => {
    const { wrapper, grid, panel } = setup({ readonly: true })
    await grid().trigger('keydown', { key: 'h', ctrlKey: true })
    expect(panel().exists()).toBe(false)
    await grid().trigger('keydown', { key: 'f', ctrlKey: true })
    expect(wrapper.findAll('.dou-find-replace__input').length).toBe(1)
    wrapper.unmount()
  })

  it('runs as commands an extension can replace, and lists matches for code', async () => {
    const asked: unknown[] = []
    const own = defineSheetExtension({
      name: 'own-find',
      commands: { find: { label: '搜索', override: true, run: (_, arg) => void asked.push(arg) } },
    })
    const { wrapper, grid, panel, sheet } = setup({ extensions: [own] })
    await grid().trigger('keydown', { key: 'f', ctrlKey: true })
    expect(asked).toEqual([undefined])
    expect(panel().exists()).toBe(false)
    expect(sheet().findCells({ search: '白板', scope: 'workbook' })).toEqual([
      { sheet: 0, row: 1, col: 0 },
      { sheet: 0, row: 3, col: 0 },
      { sheet: 0, row: 4, col: 0 },
      { sheet: 1, row: 0, col: 0 },
    ])
    sheet().commands.run('replace', { search: '便签', replace: '贴纸' })
    await nextTick()
    expect(panel().exists()).toBe(true)
    expect(wrapper.findAll<HTMLInputElement>('.dou-find-replace__input')[0]!.element.value).toBe(
      '便签',
    )
    wrapper.unmount()
  })

  it('skips rows that are hidden', async () => {
    const { wrapper, sheet, doc } = setup()
    doc.value = { ...doc.value, sheets: [{ ...doc.value.sheets[0]!, rowSizes: { 3: 0 } }] }
    await nextTick()
    expect(
      sheet()
        .findCells({ search: '白板' })
        .map((f) => f.row),
    ).toEqual([1, 4])
    wrapper.unmount()
  })
})
