import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref, type VNodeChild } from 'vue'
import {
  DouChart,
  DouChartBar,
  DouChartLine,
  DouChartPie,
  DouChartScatter,
  DouChartTooltip,
} from '..'
import { allX, angleAt, nearestPoint, nearestX, rowAt, sortedOrder } from '../core/hit'
import { buildModel } from '../core/model'
import { pieSlices } from '../core/pie'
import { categoryScale, linearScale } from '../core/scale'
import { hitScatter, scatterKind } from '../core/scatter'
import type { ChartSeries, ChartView } from '../core/series'

const column = (...values: number[]) => Float64Array.from(values)

describe('finding what is under the pointer', () => {
  it('orders x values, unsorted or with gaps', () => {
    const xs = column(3, Number.NaN, 1, 2)
    expect([...sortedOrder(xs)]).toEqual([2, 3, 0])
    expect(rowAt(xs, 2)).toBe(3)
    expect(rowAt(xs, 5)).toBe(-1)
    expect(allX([column(3, 1), column(2, 1)])).toEqual([1, 2, 3])
  })

  it('snaps to the x nearest the pointer, across series', () => {
    const scale = linearScale([0, 10], [0, 100])
    expect(nearestX([column(0, 4, 10), column(6)], scale, 48)).toBe(4)
    expect(nearestX([column(0, 4, 10), column(6)], scale, 56)).toBe(6)
    expect(nearestX([column()], scale, 50)).toBeNull()
    const categories = categoryScale(['a', 'b', 'c'], [0, 300])
    expect(nearestX([column(0, 1, 2)], categories, 160)).toBe(1)
  })

  it('finds the nearest point within reach, the one on top when two are as near', () => {
    const points: Array<[number, number]> = [
      [0, 0],
      [10, 0],
      [10, 0],
    ]
    expect(
      nearestPoint(
        3,
        (i) => points[i]!,
        9,
        0,
        () => 4,
      ),
    ).toEqual({ index: 2, distance: 1 })
    expect(
      nearestPoint(
        3,
        (i) => points[i]!,
        30,
        0,
        () => 4,
      ),
    ).toBeNull()
  })

  it('measures pie angles clockwise from 12 o’clock', () => {
    expect(angleAt(0, 0, 0, -1)).toBeCloseTo(0)
    expect(angleAt(0, 0, 1, 0)).toBeCloseTo(Math.PI / 2)
    expect(angleAt(0, 0, -1, 0)).toBeCloseTo((Math.PI * 3) / 2)
  })

  it('picks the smallest bubble the pointer is in', () => {
    const rows = [
      { x: 1, y: 1, s: 100 },
      { x: 1, y: 1, s: 4 },
    ]
    const model = buildModel(
      [{ index: 0, kind: scatterKind, props: { y: 'y', size: 's' } as never }],
      { data: rows, x: 'x' },
    )
    const s = {
      ...model.series[0]!,
      index: 0,
      kind: scatterKind,
      props: model.series[0]!.input.props,
      color: '#000',
    } as ChartSeries
    const x = linearScale([0, 2], [0, 200])
    const y = linearScale([0, 2], [200, 0])
    const view = {
      x,
      y,
      horizontal: false,
      band: 0,
      point: (a: number, b: number) => [x.map(a), y.map(b)],
      plot: { x: 0, y: 0, width: 200, height: 200 },
      dpr: 1,
      colors: { surface: '#fff', grid: '#eee', baseline: '#ccc' },
    } as ChartView
    const hit = hitScatter(s as never, view, 100, 100)!
    expect(hit.index).toBe(1)
    expect(hit.radius).toBeCloseTo(4.8)
    // inside the large one only
    expect(hitScatter(s as never, view, 100, 120)?.index).toBe(0)
    expect(hitScatter(s as never, view, 0, 0)).toBeNull()
  })
})

describe('pie slices turned off', () => {
  it('keep their place and color but take no room', () => {
    const rows = [
      { k: '甲', v: 1 },
      { k: '乙', v: 3 },
    ]
    const [a, b] = pieSlices(rows, 'v', 'k', undefined, ['甲'])
    expect(a).toMatchObject({ hidden: true, share: 0, start: 0, end: 0 })
    expect(b).toMatchObject({ hidden: false, share: 1, start: 0 })
    expect(b!.end).toBeCloseTo(Math.PI * 2)
  })
})

/** Mounts a chart with a size, as happy-dom has no layout. */
async function sized(render: () => VNodeChild, width = 600, height = 300) {
  const wrapper = mount(
    defineComponent(() => render),
    { attachTo: document.body },
  )
  const root = wrapper.find('.dou-chart').element as HTMLElement
  root.getBoundingClientRect = () => ({ left: 0, top: 0, width, height }) as DOMRect
  Object.defineProperty(root, 'clientWidth', { value: width })
  Object.defineProperty(root, 'clientHeight', { value: height })
  window.dispatchEvent(new Event('resize'))
  // the size is read when the root is observed: nudge it
  ;(root.style as CSSStyleDeclaration).width = `${width}px`
  await new Promise((done) => setTimeout(done, 20))
  await nextTick()
  return { wrapper, root }
}

const sales = [
  { q: '一季度', a: 120, b: 90 },
  { q: '二季度', a: 150, b: 100 },
  { q: '三季度', a: 140, b: 110 },
]

const key = (root: HTMLElement, name: string) =>
  root.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))

describe('tooltip', () => {
  it('walks the x values with the keys and reads them out', async () => {
    const { wrapper, root } = await sized(() =>
      h(DouChart, { data: sales, x: 'q', height: 300 }, () => [
        h(DouChartBar, { y: 'a', name: '线上' }),
        h(DouChartBar, { y: 'b', name: '门店' }),
      ]),
    )
    expect(root.getAttribute('tabindex')).toBe('0')
    key(root, 'ArrowRight')
    await nextTick()
    expect(wrapper.find('.dou-chart__tooltip-title').text()).toBe('一季度')
    expect(wrapper.findAll('.dou-chart__tooltip-item').map((item) => item.text())).toEqual([
      '线上120',
      '门店90',
    ])
    // bars: a shaded band, no line
    expect(wrapper.find('.dou-chart__band').exists()).toBe(true)
    expect(wrapper.find('.dou-chart__crosshair').exists()).toBe(false)
    key(root, 'End')
    await nextTick()
    expect(wrapper.find('.dou-chart__live').text()).toBe('三季度，线上 140，门店 110')
    key(root, 'Escape')
    await nextTick()
    expect(wrapper.find('.dou-chart__tooltip').exists()).toBe(false)
    wrapper.unmount()
  })

  it('goes from point to point, and between series, for a scatter', async () => {
    const rows = [
      { x: 1, a: 5, b: 1 },
      { x: 3, a: 2, b: 4 },
    ]
    const { wrapper, root } = await sized(() =>
      h(DouChart, { data: rows, x: 'x', height: 300 }, () => [
        h(DouChartScatter, { y: 'a', name: '甲' }),
        h(DouChartScatter, { y: 'b', name: '乙' }),
      ]),
    )
    key(root, 'End')
    await nextTick()
    const title = () => wrapper.find('.dou-chart__tooltip-title').text()
    const values = () => wrapper.findAll('.dou-chart__tooltip-value').map((v) => v.text())
    expect([title(), ...values()]).toEqual(['甲', '3', '2'])
    expect(wrapper.find('.dou-chart__mark.is-ring').exists()).toBe(true)
    key(root, 'ArrowUp')
    await nextTick()
    // the other series, at the same x
    expect([title(), ...values()]).toEqual(['乙', '3', '4'])
    key(root, 'ArrowLeft')
    await nextTick()
    expect([title(), ...values()]).toEqual(['乙', '1', '1'])
    wrapper.unmount()
  })

  it('shows its slot instead, and can be turned off', async () => {
    const off = ref(false)
    const { wrapper, root } = await sized(() =>
      h(DouChart, { data: sales, x: 'q', height: 300 }, () => [
        h(DouChartLine, { y: 'a', name: '线上' }),
        h(
          DouChartTooltip,
          { disabled: off.value, crosshair: false },
          {
            default: ({ title, items }: { title?: string; items: Array<{ text: string }> }) =>
              h('b', `${title}=${items.map((item) => item.text).join('/')}`),
          },
        ),
      ]),
    )
    key(root, 'ArrowRight')
    await nextTick()
    expect(wrapper.find('.dou-chart__tooltip b').text()).toBe('一季度=120')
    expect(wrapper.find('.dou-chart__crosshair').exists()).toBe(false)
    // a dot on the line's point
    expect(wrapper.findAll('.dou-chart__mark')).toHaveLength(1)
    off.value = true
    await nextTick()
    expect(wrapper.find('.dou-chart__tooltip').exists()).toBe(false)
    expect(root.getAttribute('tabindex')).toBeNull()
    expect(root.getAttribute('role')).toBe('img')
    wrapper.unmount()
  })
})

describe('legend', () => {
  it('turns a series off and on, keeping the last one on', async () => {
    const hidden = ref(false)
    const { wrapper } = await sized(() =>
      h(DouChart, { data: sales, x: 'q', height: 300 }, () => [
        h(DouChartLine, {
          y: 'a',
          name: '线上',
          hidden: hidden.value,
          'onUpdate:hidden': (value: boolean) => (hidden.value = value),
        }),
        h(DouChartLine, { y: 'b', name: '门店' }),
      ]),
    )
    const entries = () => wrapper.findAll('.dou-chart__legend')
    expect(entries().map((e) => e.attributes('aria-pressed'))).toEqual(['true', 'true'])
    await entries()[0]!.trigger('click')
    expect(hidden.value).toBe(true)
    expect(entries()[0]!.classes()).toContain('is-off')
    // the last one shown stays on
    await entries()[1]!.trigger('click')
    expect(entries()[1]!.attributes('aria-pressed')).toBe('true')
    await entries()[0]!.trigger('click')
    expect(hidden.value).toBe(false)
    wrapper.unmount()
  })

  it('turns pie slices off by their label, without v-model too', async () => {
    const rows = [
      { k: '房租', v: 3 },
      { k: '餐饮', v: 1 },
    ]
    const { wrapper, root } = await sized(() =>
      h(DouChart, { data: rows, x: 'k', height: 300 }, () => h(DouChartPie, { value: 'v' })),
    )
    await wrapper.findAll('.dou-chart__legend')[0]!.trigger('click')
    await nextTick()
    expect(root.getAttribute('aria-label')).toMatch(/^图表。餐饮 1（100%）/)
    key(root, 'ArrowRight')
    await nextTick()
    // the slice turned off is skipped
    expect(wrapper.find('.dou-chart__tooltip-item').text()).toBe('餐饮1（100%）')
    wrapper.unmount()
  })
})
