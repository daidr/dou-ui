import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import { DouChart, DouChartArea, DouChartAxis, DouChartBar, DouChartLine, DouChartPie } from '..'
import { barKind, barLabels } from '../core/bar'
import { contrast, luminance, placeDataLabels, spread } from '../core/labels'
import { areaKind, lineKind, lineLabels, stepPoints } from '../core/line'
import { buildModel, type SeriesInput } from '../core/model'
import { categoryScale, linearScale } from '../core/scale'
import type { ChartSeries, ChartView } from '../core/series'
import type { ChartExpose } from '../types'

const input = (
  index: number,
  props: Record<string, unknown>,
  kind: SeriesInput['kind'] = barKind,
): SeriesInput => ({
  index,
  kind,
  props: props as never,
})

/** Text 6px wide a character. */
const measure = (text: string) => text.length * 6

const resolve = (model: ReturnType<typeof buildModel>): ChartSeries[] =>
  model.series.map((s) => ({
    ...s,
    index: s.input.index,
    kind: s.input.kind,
    props: s.input.props,
    color: '#000',
  }))

const rows = [
  { m: '一月', a: 30, b: 10, lo: 5 },
  { m: '二月', a: 10, b: 30, lo: 2 },
  { m: '三月', a: 20, b: 20, lo: 8 },
]

function viewFor(domain: [number, number]): ChartView {
  const x = categoryScale(['一月', '二月', '三月'], [0, 300])
  const y = linearScale(domain, [200, 0])
  return {
    x,
    y,
    horizontal: false,
    band: x.step,
    point: (px, value) => [x.map(px), y.map(value)],
    plot: { x: 0, y: 0, width: 300, height: 200 },
    dpr: 1,
    colors: { surface: '#fff', grid: '#eee', baseline: '#ccc' },
  }
}

describe('steps', () => {
  const x = [0, 10, 20]
  const y = [1, 2, 3]
  it('holds each value until the next x (after)', () => {
    const s = stepPoints(x, y, y, 3, 'after')
    expect([...s.x]).toEqual([0, 10, 10, 20, 20])
    expect([...s.y]).toEqual([1, 1, 2, 2, 3])
  })
  it('takes the next value at once (before)', () => {
    const s = stepPoints(x, y, y, 3, 'before')
    expect([...s.x]).toEqual([0, 0, 10, 10, 20])
    expect([...s.y]).toEqual([1, 2, 2, 3, 3])
  })
  it('changes halfway (middle), with the bottom stepped alike', () => {
    const s = stepPoints(x, y, [0, 0, 1], 3, 'middle')
    expect([...s.x]).toEqual([0, 5, 5, 10, 15, 15, 20])
    expect([...s.y]).toEqual([1, 1, 2, 2, 2, 3, 3])
    expect([...s.b]).toEqual([0, 0, 0, 0, 0, 1, 1])
  })
})

describe('bands and percent stacks', () => {
  it('reads an area with y0 as a band that needn’t reach 0', () => {
    const model = buildModel([input(0, { y: 'a', y0: 'lo' }, areaKind)], { data: rows, x: 'm' })
    const [s] = model.series
    expect([...s!.base!]).toEqual([5, 2, 8])
    expect(model.zero.y).toBe(false)
    expect(model.y.y).toEqual([2, 30])
  })

  it('scales each stack to reach 1 on a percent axis', () => {
    const model = buildModel(
      [input(0, { y: 'a', stack: true }), input(1, { y: 'b', stack: true })],
      { data: rows, x: 'm', percent: { y: true } },
    )
    const [a, b] = model.series
    expect([...a!.top]).toEqual([0.75, 0.25, 0.5])
    expect([...b!.top]).toEqual([1, 1, 1])
    expect([...b!.base!]).toEqual([0.75, 0.25, 0.5])
  })
})

describe('placing labels', () => {
  const bounds = { x: 0, y: 0, width: 300, height: 200 }

  it('leaves out a label that covers one placed before it', () => {
    const placed = placeDataLabels(
      [
        { key: 'a', series: 0, text: '100', anchor: { index: 0, at: [50, 100], side: 'top' } },
        { key: 'b', series: 0, text: '200', anchor: { index: 1, at: [55, 100], side: 'top' } },
        { key: 'c', series: 0, text: '300', anchor: { index: 2, at: [150, 100], side: 'top' } },
      ],
      bounds,
      measure,
    )
    expect(placed.map((l) => l.key)).toEqual(['a', 'c'])
    expect(placed[0]).toMatchObject({ left: 50, top: 100 - 4 - 16, align: 'middle' })
  })

  it('keeps a label inside its bar only where it fits, and within its room', () => {
    const placed = placeDataLabels(
      [
        {
          key: 'fits',
          series: 0,
          text: '12',
          anchor: {
            index: 0,
            at: [50, 50],
            side: 'center',
            box: { x: 30, y: 20, width: 40, height: 60, color: '#000' },
          },
        },
        {
          key: 'short',
          series: 0,
          text: '12',
          anchor: {
            index: 1,
            at: [150, 50],
            side: 'center',
            box: { x: 130, y: 45, width: 40, height: 10, color: '#000' },
          },
        },
        {
          key: 'wide',
          series: 0,
          text: '123456',
          anchor: { index: 2, at: [250, 50], side: 'top', room: 20 },
        },
      ],
      bounds,
      measure,
    )
    expect(placed.map((l) => l.key)).toEqual(['fits'])
    expect(placed[0]!.on).toBe('#000')
  })

  it('moves the ends of lines apart, within the plot', () => {
    expect(spread([50, 52, 100], 16, 0, 200)).toEqual([50, 66, 100])
    expect(spread([195, 198], 16, 0, 200)).toEqual([176, 192])
  })

  it('picks text that reads on a bar', () => {
    const dark = luminance('rgb(61, 61, 61)')!
    const light = luminance('#ffffff')!
    expect(contrast(dark, light)).toBeGreaterThan(4.5)
    expect(luminance('rgba(212, 212, 212, 1)')).toBeGreaterThan(0.6)
  })
})

describe('where series put their labels', () => {
  it('puts a line’s labels over its points, or one at its end', () => {
    const model = buildModel([input(0, { y: 'a' }, lineKind)], { data: rows, x: 'm' })
    const [s] = resolve(model)
    const view = viewFor([0, 40])
    expect(lineLabels(s!, view).map((a) => [a.index, a.side])).toEqual([
      [0, 'top'],
      [1, 'top'],
      [2, 'top'],
    ])
    s!.props = { ...s!.props, labelPosition: 'end' }
    expect(lineLabels(s!, view)).toEqual([{ index: 2, at: [250, 100], side: 'right' }])
  })

  it('puts stacked bars’ labels inside, the others past their ends', () => {
    const model = buildModel(
      [input(0, { y: 'a', stack: true }), input(1, { y: 'b', stack: true }), input(2, { y: 'b' })],
      { data: rows, x: 'm' },
    )
    const [a, , c] = resolve(model)
    const view = viewFor([0, 60])
    const inside = barLabels(a!, view)
    expect(inside[0]!.side).toBe('center')
    expect(inside[0]!.box).toMatchObject({ height: 100, color: '#000' })
    const outside = barLabels(c!, view)
    expect(outside[0]!.side).toBe('top')
    expect(outside[0]!.room).toBe(50)
  })
})

/** Mounts a chart with a size, as happy-dom has no layout. */
async function sized(slots: () => unknown, props: Record<string, unknown> = {}) {
  const wrapper = mount(DouChart, {
    props: { data: rows, x: 'm', ...props },
    slots: { default: slots as never },
    attachTo: document.body,
  })
  const root = wrapper.find('.dou-chart').element as HTMLElement
  root.getBoundingClientRect = () => ({ width: 600, height: 300 }) as DOMRect
  Object.defineProperty(root, 'clientWidth', { value: 600 })
  Object.defineProperty(root, 'clientHeight', { value: 300 })
  await wrapper.setProps({ height: 300 })
  await nextTick()
  await nextTick()
  return wrapper
}

describe('labels in the chart', () => {
  it('writes bar labels with the axis format, or a function, and exports them', async () => {
    const wrapper = await sized(() => [
      h(DouChartAxis, { for: 'y', format: (v: number) => `${v} 件` }),
      h(DouChartBar, { y: 'a', labels: true }),
      h(DouChartBar, { y: 'b', labels: (v: number) => (v > 15 ? `≈${v}` : null) }),
    ])
    const texts = wrapper.findAll('.dou-chart__value').map((l) => l.text())
    expect(texts).toEqual(expect.arrayContaining(['30 件', '10 件', '20 件', '≈30', '≈20']))
    expect(texts).not.toContain('≈10')
    const svg = (wrapper.vm as unknown as ChartExpose).exportSVG()
    expect(svg).toContain('>30 件<')
    expect(svg).toContain('>≈20<')
    wrapper.unmount()
  })

  it('shows shares on a percent axis, and both value and share in the tooltip', async () => {
    const wrapper = await sized(() => [
      h(DouChartAxis, { for: 'y', percent: true }),
      h(DouChartBar, { y: 'a', stack: true, labels: true }),
      h(DouChartBar, { y: 'b', stack: true }),
    ])
    const ticks = wrapper.findAll('.dou-chart__tick').map((t) => t.text())
    expect(ticks).toContain('100%')
    expect(wrapper.findAll('.dou-chart__value').map((l) => l.text())).toContain('75%')
    // the summary reads the values, not shares
    expect(wrapper.find('.dou-chart').attributes('aria-label')).toContain('最小 10，最大 30')
    wrapper.unmount()
  })

  it('writes a band’s two ends in its summary range', async () => {
    const wrapper = await sized(() => [h(DouChartArea, { y: 'a', y0: 'lo', name: '区间' })])
    expect(wrapper.find('.dou-chart').attributes('aria-label')).toContain('最小 2，最大 30')
    wrapper.unmount()
  })

  it('labels the slices of a pie outside, with their shares', async () => {
    const wrapper = await sized(() => [h(DouChartPie, { value: 'a', labels: true })])
    const texts = wrapper.findAll('.dou-chart__value').map((l) => l.text())
    // the right side's, then the left side's
    expect(texts).toEqual(expect.arrayContaining(['一月 50%', '二月 16.7%', '三月 33.3%']))
    expect(texts).toHaveLength(3)
    wrapper.unmount()
  })

  it('shows only one series after a double click on its legend entry, and all after another', async () => {
    const wrapper = await sized(() => [
      h(DouChartLine, { y: 'a', name: '甲' }),
      h(DouChartLine, { y: 'b', name: '乙' }),
    ])
    const entries = () => wrapper.findAll('.dou-chart__legend')
    await entries()[1]!.trigger('dblclick')
    expect(entries().map((e) => e.attributes('aria-pressed'))).toEqual(['false', 'true'])
    await entries()[1]!.trigger('dblclick')
    expect(entries().map((e) => e.attributes('aria-pressed'))).toEqual(['true', 'true'])
    wrapper.unmount()
  })
})
