import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouSheet } from '../index'
import type { SheetExpose, SheetMenuItem } from '../types'
import type { SheetWorkbook } from '../core/model'
import { applySheetSteps, SheetTransaction } from '../core/transaction'

const plan = (): SheetWorkbook => ({
  sheets: [
    {
      name: '预算',
      cells: [
        ['项目', '预算'],
        [{ value: '场地', note: '上海展览中心 2 号厅' }, 48000],
        ['物料', { value: 12600, note: '多印了 500 份' }],
      ],
    },
  ],
})

describe('notes', () => {
  it('writes, changes and takes off notes, and undoes it', () => {
    const tr = new SheetTransaction(plan())
    tr.setNote('B1', '去年的两倍')
    tr.setNote('A2', '  ')
    tr.setNote('B3', '改成 400 份')
    const cells = tr.doc.sheets[0]!.cells
    expect(cells[0]![1]).toEqual({ value: '预算', note: '去年的两倍' })
    // empty text takes the note off, leaving a bare value
    expect(cells[1]![0]).toBe('场地')
    expect(cells[2]![1]).toEqual({ value: 12600, note: '改成 400 份' })
    expect(applySheetSteps(tr.doc, tr.inverse).doc.sheets[0]!.cells).toEqual(
      plan().sheets[0]!.cells,
    )

    const cleared = new SheetTransaction(plan()).clearNotes('A1:B3')
    expect(cleared.doc.sheets[0]!.cells).toEqual([
      ['项目', '预算'],
      ['场地', 48000],
      ['物料', 12600],
    ])
  })

  it('keeps notes when values are cleared, and moves them with fills and sorts', () => {
    const tr = new SheetTransaction(plan()).clearValues('A2:B3')
    expect(tr.doc.sheets[0]!.cells[1]![0]).toEqual({ note: '上海展览中心 2 号厅' })
    const filled = new SheetTransaction(plan()).fill('A2', 'A2:A3')
    expect(filled.doc.sheets[0]!.cells[2]![0]).toEqual({
      value: '场地',
      note: '上海展览中心 2 号厅',
    })
    const sorted = new SheetTransaction(plan()).sortRange('A2:B3', [{ col: 1, order: 'asc' }])
    expect(sorted.doc.sheets[0]!.cells[1]![1]).toEqual({ value: 12600, note: '多印了 500 份' })
  })
})

const box = () => document.querySelector<HTMLTextAreaElement>('.dou-sheet__note-input')

function setup(extra: Record<string, unknown> = {}) {
  const book = ref(plan())
  const grid = ref<SheetExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouSheet, {
          ref: grid,
          modelValue: book.value,
          'onUpdate:modelValue': (value: SheetWorkbook) => (book.value = value),
          ...extra,
        }),
    ),
    { attachTo: document.body },
  )
  const input = wrapper.find('textarea').element as HTMLTextAreaElement
  const key = async (name: string, init: KeyboardEventInit = {}, target: Element = input) => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }),
    )
    await nextTick()
  }
  const cells = () => book.value.sheets[0]!.cells
  return { wrapper, book, grid, key, cells }
}

const write = async (el: HTMLTextAreaElement, text: string) => {
  el.value = text
  el.dispatchEvent(new Event('input'))
  await nextTick()
}

describe('DouSheet notes', () => {
  it('marks cells with notes and reads the note with the cell', async () => {
    const { wrapper } = setup()
    await nextTick()
    expect(wrapper.findAll('.dou-sheet__noted')).toHaveLength(2)
    const cell = wrapper.findAll('[role="gridcell"]').find((c) => c.text().startsWith('场地'))!
    expect(cell.find('.dou-sheet__sr-only').text()).toBe('批注：上海展览中心 2 号厅')
    wrapper.unmount()
  })

  it('writes a note with Shift+F2, saves with Ctrl+Enter and drops it with Escape', async () => {
    const { wrapper, grid, key, cells } = setup()
    grid.value!.select('B1')
    await nextTick()
    await key('F2', { shiftKey: true })
    await nextTick()
    expect(box()).not.toBeNull()
    await write(box()!, '去年的两倍')
    await key('Enter', { ctrlKey: true }, box()!)
    expect(cells()[0]![1]).toEqual({ value: '预算', note: '去年的两倍' })
    expect(box()).toBeNull()

    // Escape keeps the note as it was
    await key('F2', { shiftKey: true })
    await nextTick()
    expect(box()!.value).toBe('去年的两倍')
    await write(box()!, '不要了')
    await key('Escape', {}, box()!)
    expect(cells()[0]![1]).toEqual({ value: '预算', note: '去年的两倍' })

    // saving it empty takes it off
    await key('F2', { shiftKey: true })
    await nextTick()
    await write(box()!, '')
    await key('Enter', { metaKey: true }, box()!)
    expect(cells()[0]![1]).toBe('预算')
    grid.value!.undo()
    expect(cells()[0]![1]).toEqual({ value: '预算', note: '去年的两倍' })
    wrapper.unmount()
  })

  it('offers the notes in the menu and deletes the selection’s notes', async () => {
    const seen: Record<string, string | undefined>[] = []
    const { wrapper, grid, key, cells } = setup({
      menu: (items: SheetMenuItem[]) => {
        seen.push(Object.fromEntries(items.map((item) => [item.key, item.label])))
        return items
      },
    })
    grid.value!.select('B1')
    await nextTick()
    await key('F10', { shiftKey: true })
    expect(seen[0]!.note).toBe('插入批注')
    expect(seen[0]!['note-remove']).toBeUndefined()
    grid.value!.select('A2:B3')
    await nextTick()
    await key('F10', { shiftKey: true })
    expect(seen[1]!.note).toBe('编辑批注')
    expect(seen[1]!['note-remove']).toBe('删除 2 条批注')
    // Delete clears the values and keeps the notes
    await key('Delete')
    expect(cells()[1]![0]).toEqual({ note: '上海展览中心 2 号厅' })
    wrapper.unmount()
  })

  it('shows notes on a read-only grid but does not write them', async () => {
    const seen: string[][] = []
    const { wrapper, grid, key } = setup({
      readonly: true,
      menu: (items: SheetMenuItem[]) => {
        seen.push(items.map((item) => item.key))
        return items
      },
    })
    await nextTick()
    expect(wrapper.findAll('.dou-sheet__noted')).toHaveLength(2)
    grid.value!.editNote('A2')
    await nextTick()
    expect(box()).toBeNull()
    await key('F10', { shiftKey: true })
    expect(seen[0]).not.toContain('note')
    wrapper.unmount()
  })

  it('shows the active cell’s note after a pause, and Escape closes it', async () => {
    const { wrapper, grid, key } = setup()
    grid.value!.select('A1')
    grid.value!.focus()
    await nextTick()
    await key('ArrowDown')
    expect(document.querySelector('.dou-sheet__note')).toBeNull()
    await new Promise((resolve) => setTimeout(resolve, 350))
    await nextTick()
    expect(document.querySelector('.dou-sheet__note-text')?.textContent).toBe('上海展览中心 2 号厅')
    // with focus in the grid, Escape is the grid's alone
    let reached = 0
    const outside = () => reached++
    window.addEventListener('keydown', outside)
    await key('Escape')
    window.removeEventListener('keydown', outside)
    await nextTick()
    expect(document.querySelector('.dou-sheet__note')).toBeNull()
    expect(reached).toBe(0)
    // a note shown for the active cell goes when focus leaves the grid
    grid.value!.select('B3')
    await new Promise((resolve) => setTimeout(resolve, 350))
    await nextTick()
    expect(document.querySelector('.dou-sheet__note')).not.toBeNull()
    const other = document.createElement('button')
    document.body.append(other)
    other.focus()
    await nextTick()
    expect(document.querySelector('.dou-sheet__note')).toBeNull()
    other.remove()
    grid.value!.focus()
    // moving on hides it at once
    await key('ArrowDown')
    await new Promise((resolve) => setTimeout(resolve, 350))
    await nextTick()
    expect(document.querySelector('.dou-sheet__note')).toBeNull()
    wrapper.unmount()
  })
})
