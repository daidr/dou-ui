import { mount, type VueWrapper } from '@vue/test-utils'
import type { CommentThread } from 'dou-ui'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import * as Y from 'yjs'
import { collaboration } from '..'
import { DouSheet } from '../../index'
import type { SheetExpose, SheetWorkbook } from '../../index'

const START = (): SheetWorkbook => ({
  version: 1,
  sheets: [
    {
      id: 'budget',
      name: '预算',
      cells: [
        ['项目', '预算'],
        ['场地', 48000],
      ],
    },
  ],
})

const dai = { id: 'dai', name: '戴兜' }
const qing = { id: 'qing', name: '阿青' }

const wrappers: VueWrapper[] = []
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

const flush = async () => {
  for (let round = 0; round < 3; round++) {
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve))
  }
}

function client(author: typeof dai, from?: Y.Doc) {
  const doc = new Y.Doc()
  if (from) Y.applyUpdate(doc, Y.encodeStateAsUpdate(from))
  const book = ref(from ? { version: 1 as const, sheets: [{ name: '空', cells: [] }] } : START())
  const threads = ref<CommentThread[]>([])
  const extension = collaboration({ book: doc.getMap('book'), comments: doc.getMap('comments') })
  const grid = ref<SheetExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouSheet, {
          ref: grid,
          modelValue: book.value,
          'onUpdate:modelValue': (next: SheetWorkbook) => (book.value = next),
          'onUpdate:comments': (next: CommentThread[]) => (threads.value = next),
          author,
          extensions: [extension],
        }),
    ),
    { attachTo: document.body },
  )
  wrappers.push(wrapper)
  return { doc, book, threads, grid: () => grid.value!, wrapper }
}

async function send(text: string) {
  const box = document.querySelector<HTMLTextAreaElement>('.dou-sheet-comment textarea')!
  box.value = text
  box.dispatchEvent(new Event('input'))
  await nextTick()
  box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  await nextTick()
}

describe('collaboration({ comments })', () => {
  it('shares threads and their cells, and undo keeps them on their cells', async () => {
    const a = client(dai)
    await flush()
    const b = client(qing, a.doc)
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const)
      from.doc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin !== 'peer') Y.applyUpdate(to.doc, update, 'peer')
      })
    await flush()

    // typing in B2, then a thread on it
    a.grid().transact((tr) => tr.setValue('B2', 50000))
    a.grid().select('B2')
    await nextTick()
    expect(a.grid().comment()).toBe(true)
    await nextTick()
    await send('场地涨价了？')
    await flush()
    const id = a.threads.value[0]!.id
    expect(b.threads.value.map((t) => t.id)).toEqual([id])
    expect(b.book.value.sheets[0]!.cells[1]![1]).toEqual({ value: 50000, comment: id })

    // undoing the typing keeps the thread on its cell, for both
    expect(a.grid().undo()).toBe(true)
    await flush()
    expect(a.book.value.sheets[0]!.cells[1]![1]).toEqual({ value: 48000, comment: id })
    expect(b.book.value.sheets[0]!.cells[1]![1]).toEqual({ value: 48000, comment: id })

    // a reply from the other side reaches the first
    b.grid().select('B2')
    await nextTick()
    b.grid().comment()
    await nextTick()
    await send('是的，上海的场地都涨了')
    await flush()
    expect(a.threads.value[0]!.comments.map((c) => c.author.name)).toEqual(['戴兜', '阿青'])

    // a thread on an empty cell, and one who joins later reads it from the shared workbook
    a.grid().transact((tr) => tr.setComment('D4', 'empty'), { history: false })
    await flush()
    expect(b.book.value.sheets[0]!.cells[3]![3]).toEqual({ comment: 'empty' })
    const c = client(qing, a.doc)
    await flush()
    expect(c.book.value.sheets[0]!.cells[3]![3]).toEqual({ comment: 'empty' })
    expect(c.book.value.sheets[0]!.cells[1]![1]).toEqual({ value: 48000, comment: id })
  })
})
