import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  defineSheetCellType,
  defineSheetExtension,
  defineSheetImporter,
  DouSheet,
  useSheet,
  type SheetClip,
  type SheetExtension,
  type SheetPasteEvent,
  type SheetUpdate,
  type SheetWorkbook,
} from '../index'
import type { SheetExpose } from '../types'

const book = (): SheetWorkbook => ({
  sheets: [
    {
      name: '门店',
      cells: [
        ['上海', 120],
        ['杭州', 80],
      ],
    },
  ],
})

function setup(extensions: SheetExtension[], props: Record<string, unknown> = {}) {
  const doc = ref(book())
  const grid = ref<SheetExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouSheet, {
          ref: grid,
          modelValue: doc.value,
          'onUpdate:modelValue': (value: SheetWorkbook) => (doc.value = value),
          extensions,
          ...props,
        }),
    ),
    { attachTo: document.body },
  )
  const input = () => wrapper.find<HTMLElement>('.dou-sheet__main').element
  /** Pastes text, as the clipboard gives it. */
  const paste = async (text: string) => {
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: (type: string) => (type === 'text/plain' ? text : '') },
    })
    input().dispatchEvent(event)
    await nextTick()
  }
  return { wrapper, doc, grid, paste }
}

describe('extension update', () => {
  it('sees every change once it is made, and a new workbook from v-model', async () => {
    const seen: [string, unknown, unknown][] = []
    const extension = defineSheetExtension({
      name: 'saved',
      update: (update: SheetUpdate, context) => {
        // the grid is already up to date
        expect(context.doc.value).toBe(update.doc)
        seen.push([
          update.transaction?.meta.action ?? 'v-model',
          update.before.sheets[0]!.cells[0]![0],
          update.doc.sheets[0]!.cells[0]![0],
        ])
      },
    })
    const { wrapper, doc, grid } = setup([extension])
    grid.value!.transact((tr) => tr.setCell('A1', '北京'))
    await nextTick()
    grid.value!.undo()
    await nextTick()
    doc.value = { sheets: [{ name: '新', cells: [['苏州']] }] }
    await nextTick()
    expect(seen).toEqual([
      ['api', '上海', '北京'],
      ['undo', '北京', '上海'],
      ['v-model', '上海', '苏州'],
    ])
    wrapper.unmount()
  })
})

describe('extension transformPaste', () => {
  it('rewrites pasted cells before the paste event, and can stop a paste', async () => {
    const events: SheetClip[] = []
    const upper = defineSheetExtension({
      name: 'upper',
      transformPaste: (clip) => ({
        ...clip,
        cells: clip.cells.map((line) =>
          line.map((cell) => (typeof cell === 'string' ? cell.toUpperCase() : cell)),
        ),
      }),
    })
    const guard = defineSheetExtension({
      name: 'guard',
      priority: 50,
      transformPaste: (clip) => (clip.cells[0]?.[0] === 'STOP' ? null : clip),
    })
    const { wrapper, doc, grid, paste } = setup([guard, upper], {
      onPaste: (event: SheetPasteEvent) => events.push(event.clip),
    })
    grid.value!.select('A3')
    await nextTick()
    await paste('ab\tcd')
    expect(doc.value.sheets[0]!.cells[2]).toEqual(['AB', 'CD'])
    expect(events[0]!.cells).toEqual([['AB', 'CD']])
    await paste('stop')
    expect(events.length).toBe(1)
    expect(doc.value.sheets[0]!.cells[2]).toEqual(['AB', 'CD'])
    wrapper.unmount()
  })

  it('rewrites cells imported at the active cell too', async () => {
    const plain = defineSheetImporter({
      name: 'plain',
      label: 'plain',
      accept: ['.plain'],
      import: async (file) => ({
        book: { sheets: [{ name: 'x', cells: [[await file.text()]] }] },
      }),
    })
    const extension = defineSheetExtension({
      name: 'mark',
      importers: [plain],
      transformPaste: (clip) => ({ ...clip, cells: [[`${String(clip.cells[0]![0])}!`]] }),
    })
    const { wrapper, doc, grid } = setup([extension])
    grid.value!.select('B3')
    await nextTick()
    await grid.value!.importFile(new File(['新'], 'a.plain'), { mode: 'insert' })
    expect(doc.value.sheets[0]!.cells[2]![1]).toBe('新!')
    wrapper.unmount()
  })
})

describe('extension layers', () => {
  it('draws its layers over the cells, kept out of the headers', async () => {
    const Below = defineComponent(() => {
      const sheet = useSheet()
      return () => h('i', { class: 'test-below' }, sheet.sheet.value.name)
    })
    const Above = defineComponent(() => () => h('i', { class: 'test-above' }))
    const { wrapper } = setup([
      defineSheetExtension({ name: 'marks', layers: { below: [Below], above: [Above] } }),
    ])
    await nextTick()
    const below = wrapper.find('.dou-sheet__layer.is-below')
    expect(below.find('.test-below').text()).toBe('门店')
    expect(below.attributes('style')).toMatch(/clip-path: inset\(28px 0(px)? 0(px)? 48px\)/)
    expect(below.attributes('aria-hidden')).toBe('true')
    expect(wrapper.find('.dou-sheet__layer.is-above .test-above').exists()).toBe(true)
    wrapper.unmount()
  })

  it('adds no layer when no extension has one', () => {
    const { wrapper } = setup([])
    expect(wrapper.find('.dou-sheet__layer').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('cell type draw', () => {
  it('draws a cell type of its own in pictures, kept to its cell', async () => {
    const stars = defineSheetCellType({
      name: 'stars',
      format: (value) => '★'.repeat(Number(value) || 0),
      render: defineComponent(() => () => h('span', 'stars')),
      draw: (value, _setup, box) =>
        `<circle cx="${box.x + 10}" cy="${box.y + box.height / 2}" r="${Number(value)}" fill="${box.color}"/>`,
    })
    const { wrapper, grid } = setup([defineSheetExtension({ name: 'stars', cellTypes: [stars] })])
    grid.value!.transact((tr) => tr.setCell('A2', { value: 3, type: 'stars' }))
    await nextTick()
    const svg = grid.value!.exportSVG()
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
    const circle = doc.querySelector('g[clip-path] > circle')!
    expect(circle.getAttribute('cx')).toBe('10')
    expect(circle.getAttribute('cy')).toBe(String(28 + 14))
    expect(circle.getAttribute('r')).toBe('3')
    // instead of its text
    expect([...doc.querySelectorAll('text')].map((t) => t.textContent)).not.toContain('★★★')
    // the grid still shows the component
    expect(wrapper.find('.dou-sheet__cell.is-type-stars').text()).toContain('stars')
    wrapper.unmount()
  })
})
