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
import { PencilIcon } from '@dou-ui/icons'

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

  it('tells the paste event where the rewritten cells go', async () => {
    const ranges: string[] = []
    const wider = defineSheetExtension({
      name: 'wider',
      transformPaste: (clip) => ({ ...clip, cells: clip.cells.map((line) => [...line, 'x', 'y']) }),
    })
    const { wrapper, doc, grid, paste } = setup([wider], {
      onPaste: (event: SheetPasteEvent) =>
        ranges.push(`${event.range.start.col}:${event.range.end.col}`),
    })
    grid.value!.select('A3')
    await nextTick()
    await paste('a')
    expect(ranges).toEqual(['0:2'])
    expect(doc.value.sheets[0]!.cells[2]).toEqual(['a', 'x', 'y'])
    wrapper.unmount()
  })

  it('still takes cut cells away when it rewrites them, in one step', async () => {
    const data = new Map<string, string>()
    const fire = async (target: HTMLElement, type: string) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'clipboardData', {
        value: {
          setData: (k: string, v: string) => data.set(k, v),
          getData: (k: string) => data.get(k) ?? '',
        },
      })
      target.dispatchEvent(event)
      await nextTick()
    }
    let rewrite = true
    const upper = defineSheetExtension({
      name: 'upper',
      transformPaste: (clip) =>
        rewrite
          ? {
              ...clip,
              cells: clip.cells.map((line) =>
                line.map((cell) => (typeof cell === 'string' ? cell.toUpperCase() : cell)),
              ),
            }
          : clip,
    })
    const { wrapper, doc, grid } = setup([upper])
    const main = wrapper.find<HTMLElement>('.dou-sheet__main').element
    grid.value!.select('A1')
    await nextTick()
    await fire(main, 'cut')
    grid.value!.select('A4')
    await nextTick()
    await fire(main, 'paste')
    // rewritten: the new cells go down and the cut cell is emptied
    expect(doc.value.sheets[0]!.cells[3]![0]).toBe('上海')
    expect(doc.value.sheets[0]!.cells[0]![0]).toBeUndefined()
    expect(wrapper.find('.dou-sheet__mark.is-cut').exists()).toBe(false)
    grid.value!.undo()
    await nextTick()
    expect(doc.value.sheets[0]!.cells[0]![0]).toBe('上海')
    expect(doc.value.sheets[0]!.cells[3]?.[0]).toBeUndefined()
    rewrite = false
    grid.value!.select('B1')
    await nextTick()
    await fire(main, 'cut')
    grid.value!.select('B5')
    await nextTick()
    await fire(main, 'paste')
    // left alone: moved
    expect(doc.value.sheets[0]!.cells[4]![1]).toBe(120)
    expect(doc.value.sheets[0]!.cells[0]![1]).toBeUndefined()
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
  it('draws a cell type of its own in pictures, in its own coordinates and kept to its cell', async () => {
    const stars = defineSheetCellType({
      name: 'stars',
      format: (value) => '★'.repeat(Number(value) || 0),
      render: defineComponent(() => () => h('span', 'stars')),
      draw: (value, _setup, draw) =>
        `<circle cx="10" cy="${draw.height / 2}" r="${Number(value)}" fill="${draw.color('var(--dou-color-primary)')}"/>` +
        draw.text(`R&D <${draw.formatted}>`, {
          x: 20,
          y: 0,
          width: draw.width - 20,
          height: draw.height,
        }) +
        draw.icon(PencilIcon, { x: 0, y: 0, width: 12, height: 12 }, draw.look.color),
    })
    const { wrapper, grid } = setup([defineSheetExtension({ name: 'stars', cellTypes: [stars] })])
    grid.value!.transact((tr) => {
      tr.setCell('A2', { value: 3, type: 'stars' })
      tr.setCell('B2', { value: '=1/0', type: 'stars' })
    })
    await nextTick()
    const svg = grid.value!.exportSVG()
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
    expect(doc.querySelector('parsererror')).toBeNull()
    const group = doc.querySelector('g[clip-path]')!
    expect(group.getAttribute('transform')).toBe('translate(0 28)')
    const circle = group.querySelector('circle')!
    expect(circle.getAttribute('cx')).toBe('10')
    expect(circle.getAttribute('cy')).toBe('14')
    expect(circle.getAttribute('fill')).not.toContain('var(')
    expect(group.querySelector('text')!.textContent).toBe('R&D <★★★>')
    expect(group.querySelector('svg')).not.toBeNull()
    // a formula error is drawn as its text, not by the type
    expect(doc.querySelectorAll('g[clip-path]').length).toBe(1)
    expect([...doc.querySelectorAll('text')].map((t) => t.textContent)).toContain('#DIV/0!')
    // the grid still shows the component
    expect(wrapper.find('.dou-sheet__cell.is-type-stars').text()).toContain('stars')
    wrapper.unmount()
  })
})

describe('extension transact', () => {
  it('is refused on a read-only grid and says so, unlike the component', async () => {
    let ctx: Parameters<NonNullable<SheetExtension['setup']>>[0] | undefined
    const { doc, grid } = setup(
      [
        defineSheetExtension({
          name: 'test',
          setup: (context) => {
            ctx = context
          },
        }),
      ],
      { readonly: true },
    )
    const refused = ctx!.transact((tr) => tr.setCell('A1', '北京'))
    expect(refused.cancelled).toBe(true)
    expect(refused.changed).toBe(false)
    expect(doc.value.sheets[0]!.cells[0]![0]).toBe('上海')
    // kept out of the history, such as another person's change: it goes ahead
    const remote = ctx!.transact((tr) => tr.setCell('A1', '北京'), { history: false })
    expect(remote.changed).toBe(true)
    await nextTick()
    const own = grid.value!.transact((tr) => tr.setCell('A2', '苏州'))
    expect(own.cancelled).toBe(false)
    expect(doc.value.sheets[0]!.cells[1]![0]).toBe('苏州')
  })
})
