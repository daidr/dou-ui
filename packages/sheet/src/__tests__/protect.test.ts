import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  checkProtection,
  defineSheetExtension,
  DouSheet,
  DouSheetTabs,
  DouSheetToolbar,
  isLocked,
  protectionOf,
  SheetTransaction,
  type SheetExtension,
  type SheetWorkbook,
} from '../index'
import type { SheetExpose } from '../types'

/** A form: headings locked, the blanks to fill in unlocked. */
const form = (): SheetWorkbook => ({
  styles: { blank: { locked: false }, head: { bold: true } },
  sheets: [
    {
      name: '报价单',
      protect: true,
      cells: [
        [
          { value: '客户', style: 'head' },
          { value: '戴兜', style: 'blank' },
        ],
        [
          { value: '数量', style: 'head' },
          { value: 3, style: 'blank' },
        ],
        [{ value: '金额', style: 'head' }, '=B2*100'],
      ],
    },
    { name: '说明', cells: [['自由填写']] },
  ],
})

function setup(props: Record<string, unknown> = {}, book = form()) {
  const doc = ref(book)
  const grid = ref<SheetExpose>()
  const cancels: SheetTransaction[] = []
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(
          DouSheet,
          {
            ref: grid,
            modelValue: doc.value,
            'onUpdate:modelValue': (value: SheetWorkbook) => (doc.value = value),
            onTransactionCancel: (tr: SheetTransaction) => cancels.push(tr),
            ...props,
          },
          {
            header: () => h(DouSheetToolbar),
            footer: () => h(DouSheetTabs),
          },
        ),
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
  const notice = () => wrapper.find('.dou-sheet__notice').text()
  const cells = () => doc.value.sheets[0]!.cells
  return { wrapper, doc, grid, cancels, key, type, notice, cells }
}

afterEach(() => {
  document.body.innerHTML = ''
})

const run = (book: SheetWorkbook, change: (tr: SheetTransaction) => void) => {
  const tr = new SheetTransaction(book)
  change(tr)
  return checkProtection(tr)?.reason ?? null
}

describe('checkProtection', () => {
  it('lets unlocked cells change and keeps locked ones', () => {
    expect(run(form(), (tr) => tr.setValue('B1', '上海分店'))).toBe(null)
    expect(run(form(), (tr) => tr.setValue('A1', '买家'))).toBe('cell')
    // an empty cell is locked too
    expect(run(form(), (tr) => tr.setValue('D9', 1))).toBe('cell')
    expect(run(form(), (tr) => tr.setNote('A1', '备注'))).toBe('cell')
    expect(run(form(), (tr) => tr.updateCell('A1', { link: 'https://ui.daidr.me' }))).toBe('cell')
    // the other sheet isn't protected
    expect(run(form(), (tr) => tr.setValue({ sheet: 1, row: 0, col: 0 }, '改了'))).toBe(null)
  })

  it('keeps the look and the lock unless the options allow', () => {
    expect(run(form(), (tr) => tr.styleCells('A1', { italic: true }))).toBe('format')
    expect(run(form(), (tr) => tr.styleCells('B1', { locked: undefined }))).toBe('lock')
    const book = form()
    book.sheets[0]!.protect = { formatCells: true, insertRows: true }
    expect(run(book, (tr) => tr.styleCells('A1', { italic: true }))).toBe(null)
    expect(run(book, (tr) => tr.insertRows(1, 1))).toBe(null)
    expect(run(book, (tr) => tr.deleteRows(1, 1))).toBe('deleteRows')
    expect(run(book, (tr) => tr.setSize('col', 0, 120))).toBe('formatColumns')
  })

  it('keeps the rules and moves, and lets protection itself change', () => {
    expect(run(form(), (tr) => tr.updateSheet({ merges: ['A1:B1'] }))).toBe('format')
    expect(run(form(), (tr) => tr.updateSheet({ freeze: { rows: 1 } }))).toBe(null)
    expect(run(form(), (tr) => tr.moveRows('1', 3))).toBe('sheet')
    expect(run(form(), (tr) => tr.protectSheet(false))).toBe(null)
    // turned off first, the rest goes ahead
    expect(
      run(form(), (tr) => {
        tr.protectSheet(false)
        tr.setValue('A1', '买家')
      }),
    ).toBe(null)
    // turned on in the same change, the rest is held to it
    const open = form()
    delete open.sheets[0]!.protect
    expect(
      run(open, (tr) => {
        tr.protectSheet(true)
        tr.setValue('A1', '买家')
      }),
    ).toBe('cell')
  })

  it('deletes lines only without locked cells, even when deleting is allowed', () => {
    const book = form()
    book.sheets[0]!.protect = { deleteRows: true, deleteColumns: true }
    expect(run(book, (tr) => tr.deleteRows(0, 1))).toBe('cell')
    expect(run(book, (tr) => tr.deleteCols('B'))).toBe('cell')
    expect(run(book, (tr) => tr.deleteRows(5, 2))).toBe(null)
  })

  it('lets formulas follow moved lines and renamed sheets, and nothing more', () => {
    const book = form()
    book.sheets[0]!.protect = { insertRows: true }
    book.sheets[0]!.cells[3] = [{ value: '=说明!A1', style: 'head' }]
    // the references follow
    expect(run(book, (tr) => tr.insertRows(1, 1))).toBe(null)
    expect(run(book, (tr) => tr.renameSheet(1, '附录'))).toBe(null)
    // what comes after them is checked as any change
    expect(
      run(book, (tr) => {
        tr.renameSheet(1, '附录')
        tr.setValue('A4', '=999')
      }),
    ).toBe('cell')
    expect(
      run(book, (tr) => {
        tr.insertRows(5, 1)
        tr.addValidation({ range: 'B1', list: ['上海'] })
      }),
    ).toBe('sheet')
  })

  it('keeps the look of locked cells from styles and types changed in place', () => {
    const book = { ...form(), types: { city: { type: 'select', options: ['上海'] } } }
    book.sheets[0]!.cells[0]![0] = { value: '客户', style: 'head', type: 'city' }
    expect(run(book, (tr) => tr.setStyle('head', { bold: true, tone: 'danger' }))).toBe('format')
    expect(run(book, (tr) => tr.setType('city', { type: 'select', options: ['北京'] }))).toBe(
      'format',
    )
    // a style only unlocked cells use
    expect(run(book, (tr) => tr.setStyle('blank', { locked: false, italic: true }))).toBe(null)
    book.sheets[0]!.protect = { formatCells: true }
    expect(run(book, (tr) => tr.setStyle('head', { bold: true, tone: 'danger' }))).toBe(null)
  })

  it('tells locked cells as `cells` hold them', () => {
    const book = form()
    expect(isLocked('客户', book)).toBe(true)
    expect(isLocked(3, book)).toBe(true)
    expect(isLocked({ value: 1, style: 'blank' }, book)).toBe(false)
    expect(protectionOf(book.sheets[0])).toEqual({})
    expect(protectionOf(book.sheets[1])).toBe(null)
  })

  it('keeps the sheets of a protected workbook', () => {
    const book = { ...form(), protect: true }
    expect(run(book, (tr) => tr.addSheet({ name: '新表' }))).toBe('structure')
    expect(run(book, (tr) => tr.renameSheet(1, '附录'))).toBe('structure')
    expect(run(book, (tr) => tr.moveSheet(1, 0))).toBe('structure')
    expect(run(book, (tr) => tr.removeSheet(1))).toBe('structure')
    expect(run(book, (tr) => tr.updateBook({ protect: undefined }))).toBe(null)
    expect(run(form(), (tr) => tr.renameSheet(0, '报价'))).toBe(null)
  })
})

describe('protected sheets in the grid', () => {
  it('refuses to edit a locked cell and says why', async () => {
    const { key, type, cancels, notice, cells } = setup()
    await type('买家')
    expect(notice()).toBe('单元格受保护，不能修改')
    expect(cells()[0]![0]).toEqual({ value: '客户', style: 'head' })
    // the blank beside it takes typing
    await key('ArrowRight')
    await type('上海分店')
    await key('Enter')
    expect(cells()[0]![1]).toEqual({ value: '上海分店', style: 'blank' })
    // Delete over both: nothing changes, and the change is cancelled
    await key('ArrowUp')
    await key('ArrowLeft', { shiftKey: true })
    await key('Delete')
    expect(cells()[0]![1]).toEqual({ value: '上海分店', style: 'blank' })
    expect(cancels.at(-1)?.cancelReason).toBe('单元格受保护，不能修改')
  })

  it.each([
    ['pastes only what the cells hold, keeping their look', true, 'blank'],
    // the look comes along, and the cell stays unlocked
    ['pastes the look too when the format of cells may change', { formatCells: true }, 'head 2'],
  ] as const)('%s', async (_, protect, style) => {
    const book = form()
    book.sheets[0]!.protect = protect
    const { grid, cells, doc } = setup({}, book)
    grid.value!.select('B1')
    grid.value!.transact((tr) => tr.setCell('B1', { value: '戴兜', style: 'blank' }))
    // copied from a locked cell with its own style
    const event = new Event('paste', { bubbles: true, cancelable: true })
    const clip = {
      cells: [[{ value: '新客户', style: 'head' }]],
      styles: { head: { bold: true } },
      from: { row: 0, col: 0 },
    }
    const html = `<table data-dou-sheet="${JSON.stringify(clip).replaceAll('"', '&quot;')}"><tr><td>新客户</td></tr></table>`
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: (type: string) => (type === 'text/html' ? html : '新客户') },
    })
    document.querySelector('.dou-sheet__main')!.dispatchEvent(event)
    await nextTick()
    expect(cells()[0]![1]).toEqual({ value: '新客户', style })
    expect(doc.value.styles![style]!.locked).toBe(false)
  })

  it('lets code fill a protected form with `protection: false`', () => {
    const { grid, cells, cancels } = setup()
    expect(grid.value!.transact((tr) => tr.setValue('A1', '买家')).cancelled).toBe(true)
    expect(cancels).toHaveLength(1)
    grid.value!.transact((tr) => tr.setValue('A1', '买家'), { protection: false })
    expect(cells()[0]![0]).toEqual({ value: '买家', style: 'head' })
  })

  it('keeps protected cells from code on a read-only grid too, unless told otherwise', () => {
    const { grid, cells } = setup({ readonly: true })
    expect(grid.value!.transact((tr) => tr.setValue('A1', '买家')).cancelled).toBe(true)
    grid.value!.transact((tr) => tr.setValue('A1', '买家'), { protection: false })
    expect(cells()[0]![0]).toEqual({ value: '买家', style: 'head' })
  })

  it('protects and unprotects from the commands, and locks cells', async () => {
    const { wrapper, grid, doc } = setup({}, { ...form(), sheets: [{ name: '表', cells: [] }] })
    const sheet = () => doc.value.sheets[0]!
    grid.value!.select('B2:C3')
    expect(grid.value!.commands.run('lock')).toBe(true)
    const style = (sheet().cells[1]![1] as { style: string }).style
    expect(doc.value.styles![style]).toEqual({ locked: false })
    expect(grid.value!.commands.get('lock')!.label).toBe('锁定单元格')
    grid.value!.commands.run('protect.sheet')
    expect(sheet().protect).toBe(true)
    // the lock stays while the sheet is protected
    expect(grid.value!.commands.can('lock')).toBe(false)
    await nextTick()
    expect(wrapper.find('.dou-sheet-tabs__lock').exists()).toBe(true)
    expect(wrapper.find('.dou-sheet-tabs__tab').text()).toContain('受保护')
    grid.value!.commands.run('protect.workbook')
    expect(doc.value.protect).toBe(true)
    await nextTick()
    // no adding sheets now
    expect(wrapper.find('.dou-sheet-tabs__add').exists()).toBe(false)
    grid.value!.undo()
    grid.value!.undo()
    expect(doc.value.protect).toBeUndefined()
    expect(sheet().protect).toBeUndefined()
  })
})

describe('cancelling a change', () => {
  it('lets an extension cancel a change with a reason, before it is applied', async () => {
    const updates = vi.fn<() => void>()
    const after = vi.fn<() => void>()
    const guard: SheetExtension = defineSheetExtension({
      name: 'guard',
      transaction: (tr) => {
        if (tr.steps.some((step) => step.type === 'setCell' && step.col === 0))
          tr.cancel('A 列由系统填写')
      },
      update: updates,
    })
    const later: SheetExtension = defineSheetExtension({
      name: 'later',
      priority: 50,
      transaction: after,
    })
    const book: SheetWorkbook = { sheets: [{ name: '表', cells: [['原值']] }] }
    const { grid, cancels, notice, cells, wrapper } = setup({ extensions: [guard, later] }, book)
    const tr = grid.value!.transact((t) => t.setValue('A1', '新值'))
    expect(tr.cancelled).toBe(true)
    expect(tr.changed).toBe(false)
    await nextTick()
    expect(cells()[0]![0]).toBe('原值')
    expect(cancels[0]!.cancelled).toBe(true)
    expect(cancels[0]!.cancelReason).toBe('A 列由系统填写')
    expect(notice()).toBe('A 列由系统填写')
    // hooks after it don't run, nothing is applied, nothing to undo
    expect(after).not.toHaveBeenCalled()
    expect(updates).not.toHaveBeenCalled()
    expect(grid.value!.canUndo).toBe(false)
    // other changes go ahead
    expect(grid.value!.transact((t) => t.setValue('B1', 1)).changed).toBe(true)
    expect(after).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it("can't cancel a change kept out of the history", () => {
    const tr = new SheetTransaction(form())
    tr.setMeta({ history: false }).cancel('不行')
    expect(tr.cancelled).toBe(false)
  })
})
