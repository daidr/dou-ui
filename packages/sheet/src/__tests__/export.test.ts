import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouSheet, type SheetWorkbook } from '../index'
import type { SheetExpose } from '../types'
import { drawSheet, wrapLines, type DrawLook, type SheetDrawing } from '../export/draw'

/** Every character 10px wide. */
const measure = (text: string) => text.length * 10

const look = (extra: Partial<DrawLook> = {}): DrawLook => ({
  color: '#111111',
  background: null,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  align: 'left',
  valign: 'middle',
  wrap: false,
  line: null,
  ...extra,
})

const drawing = (extra: Partial<SheetDrawing> = {}): SheetDrawing => ({
  colWidths: [100, 100, 100],
  rowHeights: [28, 28],
  headerWidth: 0,
  headerHeight: 0,
  frozenRows: 0,
  frozenCols: 0,
  cells: [],
  gridlines: true,
  background: true,
  theme: {
    fontFamily: 'sans-serif',
    fontSize: 13,
    boldWeight: '600',
    surface: '#ffffff',
    line: '#eeeeee',
    freezeLine: '#999999',
    headerBg: '#f5f5f5',
    headerText: '#666666',
    headerLine: '#dddddd',
    checkBorder: '#cccccc',
    checkBg: '#ffffff',
    checkOn: '#ffffff',
    checkOnBg: '#111111',
  },
  ...extra,
})

const parse = (svg: string) => {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  expect(doc.querySelector('parsererror')).toBeNull()
  return doc
}

describe('wrapLines', () => {
  it('breaks at spaces, between CJK characters and inside long words', () => {
    expect(wrapLines('one two three', 70, measure)).toEqual(['one two', 'three'])
    expect(wrapLines('上海静安门店', 40, measure)).toEqual(['上海静安', '门店'])
    expect(wrapLines('abcdefghij', 40, measure)).toEqual(['abcd', 'efgh', 'ij'])
    expect(wrapLines('a\nb', 100, measure)).toEqual(['a', 'b'])
  })
})

describe('drawSheet', () => {
  it('draws text, fills and escapes what it writes', () => {
    const svg = drawSheet(
      drawing({
        cells: [
          { x: 0, y: 0, width: 100, height: 28, text: 'A & <B>', look: look({ bold: true }) },
          {
            x: 100,
            y: 0,
            width: 100,
            height: 28,
            text: '42',
            look: look({ align: 'right', background: '#f0f0f0', color: '#222222' }),
          },
        ],
      }),
      (text) => measure(text),
    )
    const doc = parse(svg)
    const texts = [...doc.querySelectorAll('text')]
    expect(texts.map((t) => t.textContent)).toEqual(['A & <B>', '42'])
    expect(texts[0]!.getAttribute('font-weight')).toBe('bold')
    expect(texts[1]!.getAttribute('text-anchor')).toBe('end')
    expect(texts[1]!.getAttribute('x')).toBe('192')
    expect(doc.querySelector('rect[fill="#f0f0f0"]')).not.toBeNull()
    // the background, and none without it
    expect(svg).toContain('<rect width="300" height="56" fill="#ffffff"/>')
    expect(drawSheet(drawing({ background: false }), measure)).not.toContain('fill="#ffffff"')
  })

  it('clips text wider than its cell, and wraps it when the cell wraps', () => {
    const long = 'abcdefghijklmnopqrstuvwxyz'
    const doc = parse(
      drawSheet(
        drawing({
          rowHeights: [80],
          cells: [
            { x: 0, y: 0, width: 100, height: 80, text: long, look: look() },
            { x: 100, y: 0, width: 100, height: 80, text: long, look: look({ wrap: true }) },
          ],
        }),
        measure,
      ),
    )
    const [cut, wrapped] = [...doc.querySelectorAll('text')]
    expect(cut!.getAttribute('clip-path')).toMatch(/^url\(#c\d+\)$/)
    expect([...wrapped!.querySelectorAll('tspan')].map((t) => t.textContent)).toEqual([
      'abcdefgh',
      'ijklmnop',
      'qrstuvwx',
      'yz',
    ])
  })

  it('leaves out the lines inside a merge and draws a firmer line after the frozen ones', () => {
    const svg = drawSheet(
      drawing({
        frozenCols: 1,
        cells: [{ x: 100, y: 0, width: 200, height: 28, text: '合并', look: look(), merged: true }],
      }),
      measure,
    )
    const grid = /<path d="([^"]+)" stroke="#eeeeee"/.exec(svg)![1]!
    // the edge between the merged columns runs only under the merge
    expect(grid).toContain('M199.5 28V56')
    expect(grid).not.toContain('M199.5 0V56')
    expect(svg).toContain('<path d="M99.5 0V56" stroke="#999999"')
  })

  it('draws the headers, check boxes and tags', () => {
    const doc = parse(
      drawSheet(
        drawing({
          headerWidth: 40,
          headerHeight: 28,
          colNames: ['A', 'B', 'C'],
          rowNames: ['1', '2'],
          cells: [
            { x: 0, y: 0, width: 100, height: 28, text: '', look: look(), check: true },
            {
              x: 100,
              y: 0,
              width: 100,
              height: 28,
              text: '已完成',
              look: look(),
              tag: { background: '#eef', color: '#335', border: '#ccd' },
            },
          ],
        }),
        measure,
      ),
    )
    const texts = [...doc.querySelectorAll('text')].map((t) => t.textContent)
    expect(texts).toEqual(expect.arrayContaining(['A', 'B', 'C', '1', '2', '已完成']))
    expect(doc.querySelector('rect[rx="3.5"][fill="#111111"]')).not.toBeNull()
    expect(doc.querySelector('rect[fill="#eef"][stroke="#ccd"]')).not.toBeNull()
  })
})

const book = (): SheetWorkbook => ({
  styles: { head: { bold: true } },
  sheets: [
    {
      name: '门店',
      freeze: { rows: 1 },
      merges: ['A3:B3'],
      rowSizes: { 3: 0 },
      cells: [
        [
          { value: '门店', style: 'head' },
          { value: '销售额', style: 'head' },
        ],
        ['上海静安', { value: 196800, format: '¥#,##0' }],
        ['合计'],
        ['隐藏的行', 1],
        ['上海徐汇', { value: '=B2/2', format: '¥#,##0' }],
      ],
    },
  ],
})

function setup(data = book()) {
  const grid = ref<SheetExpose>()
  const wrapper = mount(
    defineComponent(() => () => h(DouSheet, { ref: grid, modelValue: data })),
    { attachTo: document.body },
  )
  return { wrapper, grid }
}

describe('DouSheet export', () => {
  afterEach(() => vi.restoreAllMocks())

  it('draws the cells with data, without the selection or hidden rows', async () => {
    const { wrapper, grid } = setup()
    await nextTick()
    const svg = grid.value!.toSVG()
    const doc = parse(svg)
    const texts = [...doc.querySelectorAll('text')].map((t) => t.textContent)
    expect(texts).toEqual(['门店', '销售额', '上海静安', '¥196,800', '合计', '上海徐汇', '¥98,400'])
    // four rows shown, two columns of the default width
    expect(doc.documentElement.getAttribute('height')).toBe(String(4 * 28))
    // the probes are gone
    expect(wrapper.findAll('.dou-sheet').length).toBe(1)
    wrapper.unmount()
  })

  it('draws a range with the headers', async () => {
    const { wrapper, grid } = setup()
    await nextTick()
    const texts = [
      ...parse(grid.value!.toSVG({ range: 'B1:B2', headers: true })).querySelectorAll('text'),
    ].map((t) => t.textContent)
    expect(texts).toEqual(['销售额', '¥196,800', 'B', '1', '2'])
    expect(() => grid.value!.toSVG({ range: 'nope' })).toThrow(RangeError)
    wrapper.unmount()
  })

  it('prints on pages of their own, with the frozen rows on every page', async () => {
    const { wrapper, grid } = setup()
    await nextTick()
    // the test DOM loads no frames: a stand-in with a document of its own
    let html = ''
    const create = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag !== 'iframe') return create(tag)
      const frame = create('div')
      const doc = document.implementation.createHTMLDocument()
      Object.defineProperty(frame, 'contentDocument', { value: doc })
      Object.defineProperty(frame, 'contentWindow', {
        value: {
          focus() {},
          addEventListener() {},
          print: () => (html = doc.documentElement.outerHTML),
        },
      })
      return frame
    })
    grid.value!.print({ title: '十月门店' })
    expect(html).toContain('@page{size:A4 portrait')
    expect(html).toContain('<h1>十月门店</h1>')
    expect(html.match(/class="page"/g)).toHaveLength(1)
    expect(html).toContain('>门店<')
    wrapper.unmount()

    // 80 rows of 28px: three portrait pages, each starting with the frozen head row
    const long = book()
    long.sheets[0]!.cells = [
      [{ value: '门店', style: 'head' }],
      ...Array.from({ length: 79 }, (_, i) => [`第 ${i + 1} 家`]),
    ]
    long.sheets[0]!.merges = []
    long.sheets[0]!.rowSizes = {}
    const other = setup(long)
    await nextTick()
    other.grid.value!.print()
    expect(html.match(/class="page"/g)).toHaveLength(3)
    expect(html.match(/>门店</g)).toHaveLength(3)
    expect(html).toContain('>第 79 家<')
    other.wrapper.unmount()
  })
})
