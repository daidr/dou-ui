import { mount } from '@vue/test-utils'
import { DouCommentThread, type CommentAction, type CommentThread } from 'dou-ui'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouSheet } from '../index'
import type { SheetExpose } from '../types'
import type { SheetWorkbook } from '../core/model'
import { keepCommentAnchors, sheetCommentAnchors } from '../core/comments'
import { applySheetSteps, SheetTransaction } from '../core/transaction'

const dai = { id: 'dai', name: '戴兜' }

const plan = (): SheetWorkbook => ({
  sheets: [
    {
      id: 'budget',
      name: '预算',
      cells: [
        ['项目', '预算'],
        [{ value: '场地', comment: 't1' }, 48000],
        ['物料', 12600],
      ],
    },
  ],
})

const thread = (id = 't1', resolved = false): CommentThread => ({
  id,
  comments: [{ id: `${id}-c`, author: dai, body: '场地费是含税的吗？', createdAt: '2026-11-01' }],
  ...(resolved ? { resolved: { by: dai, at: '2026-11-01' } } : {}),
})

describe('comment anchors', () => {
  it('finds threads, and keeps them through an undo that restores their cells', () => {
    expect(sheetCommentAnchors(plan()).get('t1')).toEqual({
      sheet: 'budget',
      row: 1,
      col: 0,
      address: 'A2',
    })
    // typing in a cell, then a thread put on it apart from the history
    const typed = new SheetTransaction(plan()).setValue('B3', 13000)
    const commented = new SheetTransaction(typed.doc).setComment('B3', 't2')
    const anchors = sheetCommentAnchors(commented.doc)
    const undo = applySheetSteps(commented.doc, typed.inverse)
    expect(undo.doc.sheets[0]!.cells[2]![1]).toBe(12600)
    keepCommentAnchors(anchors, undo)
    expect(undo.doc.sheets[0]!.cells[2]![1]).toEqual({ value: 12600, comment: 't2' })
  })

  it('follows rows the undo takes out, and lets a moved thread go back', () => {
    // a row inserted above the thread, then undone: the thread moves up with its cell
    const inserted = new SheetTransaction(plan()).insertRows(0)
    const commented = new SheetTransaction(inserted.doc).setComment('B4', 't2')
    const undo = applySheetSteps(commented.doc, inserted.inverse)
    keepCommentAnchors(sheetCommentAnchors(commented.doc), undo)
    expect(undo.doc.sheets[0]!.cells[2]![1]).toEqual({ value: 12600, comment: 't2' })

    // a cut cell moved back by undo takes its thread back, once
    const moved = new SheetTransaction(plan()).moveCells('A2', 'D5')
    const back = applySheetSteps(moved.doc, moved.inverse)
    keepCommentAnchors(sheetCommentAnchors(moved.doc), back)
    expect(back.doc.sheets[0]!.cells[1]![0]).toEqual({ value: '场地', comment: 't1' })
    expect(back.doc.sheets[0]!.cells[4]?.[3]).toBeUndefined()
  })

  it('leaves a thread behind when cells are filled, and keeps the one filled over', () => {
    const tr = new SheetTransaction(plan()).setComment('A3', 't2').fill('A2', 'A2:A4')
    const cells = tr.doc.sheets[0]!.cells
    expect(cells[2]![0]).toEqual({ value: '场地', comment: 't2' })
    expect(cells[3]![0]).toBe('场地')
  })
})

function setup(props: Record<string, unknown> = {}, start: SheetWorkbook = plan()) {
  const book = ref(start)
  const threads = ref<CommentThread[]>([thread()])
  const active = ref<string | null>(null)
  const actions: CommentAction[] = []
  const grid = ref<SheetExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouSheet, {
          ref: grid,
          modelValue: book.value,
          'onUpdate:modelValue': (value: SheetWorkbook) => (book.value = value),
          comments: threads.value,
          'onUpdate:comments': (value: CommentThread[]) => (threads.value = value),
          activeComment: active.value,
          'onUpdate:activeComment': (value: string | null) => (active.value = value),
          onCommentAction: (action: CommentAction) => actions.push(action),
          author: dai,
          ...props,
        }),
    ),
    { attachTo: document.body },
  )
  const gridInput = wrapper.find('textarea').element as HTMLTextAreaElement
  const key = async (name: string, init: KeyboardEventInit = {}, target: Element = gridInput) => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }),
    )
    await nextTick()
    await nextTick()
  }
  const cells = () => book.value.sheets[0]!.cells
  return { wrapper, book, threads, active, actions, grid, key, cells }
}

const card = () => document.querySelector<HTMLElement>('.dou-sheet-comment')
const replyBox = () => card()?.querySelector('textarea') ?? null

async function send(text: string) {
  const box = replyBox()!
  box.value = text
  box.dispatchEvent(new Event('input'))
  await nextTick()
  box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  await nextTick()
  await nextTick()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DouSheet comments', () => {
  it('marks cells with open threads and reads them out', async () => {
    const { wrapper, threads } = setup()
    await nextTick()
    expect(wrapper.findAll('.dou-sheet__commented')).toHaveLength(1)
    const cell = wrapper.findAll('[role="gridcell"]').find((c) => c.text().startsWith('场地'))!
    expect(cell.find('.dou-sheet__sr-only').text()).toBe('有评论')
    // a resolved thread shows no mark
    threads.value = [thread('t1', true)]
    await nextTick()
    expect(wrapper.findAll('.dou-sheet__commented')).toHaveLength(0)
    wrapper.unmount()
  })

  it('starts a thread with Mod+Alt+M, outside the undo history', async () => {
    const { wrapper, grid, key, cells, threads, actions } = setup()
    grid.value!.select('B3')
    await nextTick()
    await key('m', { ctrlKey: true, altKey: true })
    expect(card()).not.toBeNull()
    await send('物料费能再压一压吗')
    const created = actions[0]!
    expect(created.type).toBe('create')
    const id = created.type === 'create' ? created.thread.id : ''
    expect(cells()[2]![1]).toEqual({ value: 12600, comment: id })
    expect(threads.value.map((t) => t.id)).toEqual(['t1', id])
    expect(grid.value!.getCommentAnchors()[id]).toMatchObject({ address: 'B3' })
    // undo has nothing of it to take back
    expect(grid.value!.canUndo).toBe(false)
    wrapper.unmount()
  })

  it('opens a thread from the cell, closes it with Escape, and keeps it on undo', async () => {
    const { wrapper, grid, key, cells, active } = setup()
    grid.value!.select('A2')
    await nextTick()
    expect(grid.value!.comment()).toBe(true)
    await nextTick()
    expect(active.value).toBe('t1')
    expect(card()!.textContent).toContain('场地费是含税的吗？')
    await key('Escape', {}, document.activeElement ?? document.body)
    expect(active.value).toBeNull()

    // typing over the cell and undoing it keeps its thread
    grid.value!.transact((tr) => tr.setValue('A2', '场地租金'))
    grid.value!.undo()
    expect(cells()[1]![0]).toEqual({ value: '场地', comment: 't1' })
    wrapper.unmount()
  })

  it('copies cells without their threads and cuts them with theirs', async () => {
    const { wrapper, grid, cells } = setup()
    grid.value!.select('A2')
    await nextTick()
    const copied = new DataTransfer()
    const target = wrapper.find('.dou-sheet__main').element
    target.dispatchEvent(
      Object.assign(new Event('copy', { bubbles: true }), { clipboardData: copied }),
    )
    grid.value!.select('D5')
    await nextTick()
    target.dispatchEvent(
      Object.assign(new Event('paste', { bubbles: true }), { clipboardData: copied }),
    )
    await nextTick()
    expect(cells()[4]![3]).toBe('场地')
    expect(cells()[1]![0]).toEqual({ value: '场地', comment: 't1' })
    wrapper.unmount()
  })

  it('keeps threads on a protected sheet, where locked cells can still be commented on', async () => {
    const start = plan()
    start.styles = { open: { locked: false } }
    start.sheets[0]!.protect = true
    start.sheets[0]!.cells[1]![0] = { value: '场地', comment: 't1', style: 'open' }
    const { wrapper, grid, key, cells, actions } = setup({}, start)
    // pasting over an unlocked cell keeps its thread
    grid.value!.select('B3')
    await nextTick()
    const copied = new DataTransfer()
    const target = wrapper.find('.dou-sheet__main').element
    target.dispatchEvent(
      Object.assign(new Event('copy', { bubbles: true }), { clipboardData: copied }),
    )
    grid.value!.select('A2')
    await nextTick()
    target.dispatchEvent(
      Object.assign(new Event('paste', { bubbles: true }), { clipboardData: copied }),
    )
    await nextTick()
    expect(cells()[1]![0]).toMatchObject({ value: 12600, comment: 't1' })
    // a locked cell takes a thread
    grid.value!.select('B2')
    await nextTick()
    await key('m', { ctrlKey: true, altKey: true })
    await send('合同里写的是不含税')
    const created = actions.find((action) => action.type === 'create')!
    const id = created.type === 'create' ? created.thread.id : ''
    expect(cells()[1]![1]).toEqual({ value: 48000, comment: id })
    wrapper.unmount()
  })

  it('takes the anchor off when the thread is removed', async () => {
    const { wrapper, grid, cells, actions } = setup()
    grid.value!.select('A2')
    await nextTick()
    grid.value!.comment()
    await nextTick()
    wrapper.findComponent(DouCommentThread).vm.$emit('action', {
      type: 'remove',
      threadId: 't1',
    })
    await nextTick()
    expect(actions.at(-1)!.type).toBe('remove')
    expect(cells()[1]![0]).toBe('场地')
    wrapper.unmount()
  })
})
