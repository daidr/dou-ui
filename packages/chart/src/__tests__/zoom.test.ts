import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref, type VNodeChild } from 'vue'
import { DouChart, DouChartBar, DouChartBrush, DouChartLine, DouChartRange, DouChartZoom } from '..'
import { layoutChart, type ChartAxes } from '../core/layout'
import { buildModel } from '../core/model'
import { linearScale, logScale } from '../core/scale'
import { barKind } from '../core/bar'
import { lineKind } from '../core/line'
import type { ChartInterval } from '../types'
import {
  clampWindow,
  intervalToWindow,
  panWindow,
  snapCategories,
  unitsOf,
  windowToInterval,
  zoomWindow,
} from '../core/window'

describe('zoom windows', () => {
  const months = ['1月', '2月', '3月', '4月', '5月', '6月']

  it('reads intervals as given: categories take their whole step', () => {
    expect(intervalToWindow(['2月', '4月'], 'category', months)).toEqual([0.5, 3.5])
    expect(intervalToWindow(['4月', '2月'], 'category', months)).toEqual([0.5, 3.5])
    expect(intervalToWindow(['2月', '七月'], 'category', months)).toBeNull()
    expect(intervalToWindow([new Date(10), new Date(30)], 'time', [])).toEqual([10, 30])
    expect(intervalToWindow([5, 5], 'linear', [])).toBeNull()
    expect(intervalToWindow(null, 'linear', [])).toBeNull()
  })

  it('gives intervals back as values: the categories mostly shown, dates', () => {
    expect(windowToInterval([0.5, 3.5], 'category', months)).toEqual(['2月', '4月'])
    expect(windowToInterval([0.8, 3.1], 'category', months)).toEqual(['2月', '4月'])
    expect(windowToInterval([0.8, 2.9], 'category', months)).toEqual(['2月', '3月'])
    const [from, to] = windowToInterval([10, 30], 'time', [])
    expect(from).toBeInstanceOf(Date)
    expect(+to).toBe(30)
    expect(snapCategories([1.2, 1.4])).toEqual([0.5, 1.5])
  })

  it('keeps a window inside the whole: moved back at an end, never narrower than the least', () => {
    expect(clampWindow([-2, 3], [0, 10], 1)).toEqual([0, 5])
    expect(clampWindow([8, 12], [0, 10], 1)).toEqual([6, 10])
    expect(clampWindow([4, 4.1], [0, 10], 1)).toEqual([3.55, 4.55])
    // all of it: not zoomed
    expect(clampWindow([-1, 11], [0, 10], 1)).toBeNull()
    // on a log axis, in its powers of ten
    const window = clampWindow([1, 1000], [1, 10000], 0.1, unitsOf({ kind: 'log' }))!
    expect(window[0]).toBeCloseTo(1)
    expect(window[1]).toBeCloseTo(1000)
  })

  it('zooms about a pixel and pans by pixels', () => {
    const scale = linearScale([0, 100], [0, 200])
    expect(zoomWindow(scale, 100, 0.5)).toEqual([25, 75])
    expect(zoomWindow(scale, 0, 0.5)).toEqual([0, 50])
    expect(panWindow(scale, 20)).toEqual([10, 110])
    // a value axis runs up: its range is reversed
    const up = linearScale([0, 100], [200, 0])
    expect(zoomWindow(up, 100, 0.5)).toEqual([25, 75])
    const log = logScale([1, 10000], [0, 400])
    const [a, b] = zoomWindow(log, 200, 0.5)
    expect(a).toBeCloseTo(10)
    expect(b).toBeCloseTo(1000)
  })
})

describe('zoomed layout', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ m: `${i + 1}月`, v: (i + 1) * 10, w: i }))
  const model = buildModel([{ index: 0, kind: barKind, props: { y: 'v' } as never }], {
    data: rows,
    x: 'm',
  })
  const axes: ChartAxes = {
    x: { position: 'bottom', grid: false, hidden: false },
    y: { position: 'left', grid: true, hidden: false },
    y2: null,
  }
  const base = { model, axes, width: 600, height: 300, locale: 'zh-CN', measure: () => 24 }

  it('shows only the categories zoomed in to, and keeps the whole domain', () => {
    const l = layoutChart({ ...base, zoom: { x: [2.5, 5.5] } })
    expect(l.x.scale.domain).toEqual([2.5, 5.5])
    expect(l.x.full).toEqual([-0.5, 11.5])
    expect(l.x.labels.map((label) => label.text)).toEqual(['4月', '5月', '6月'])
    expect(l.x.scale.step).toBeCloseTo(l.plot.width / 3)
  })

  it('zooms the values, a second axis following the same part', () => {
    const both = buildModel(
      [
        { index: 0, kind: lineKind, props: { y: 'v' } as never },
        { index: 1, kind: lineKind, props: { y: 'w', axis: 'y2' } as never },
      ],
      { data: rows, x: 'm' },
    )
    const whole = layoutChart({
      ...base,
      model: both,
      axes: { ...axes, y2: { position: 'right', grid: false, hidden: false } },
    })
    const l = layoutChart({
      ...base,
      model: both,
      axes: { ...axes, y2: { position: 'right', grid: false, hidden: false } },
      zoom: {
        y: [
          whole.y.y!.scale.domain[0],
          (whole.y.y!.scale.domain[1] + whole.y.y!.scale.domain[0]) / 2,
        ],
      },
    })
    expect(l.y.y!.full).toEqual(whole.y.y!.scale.domain)
    const [a, b] = whole.y.y2!.scale.domain
    expect(l.y.y2!.scale.domain).toEqual([a, (a + b) / 2])
    expect(
      l.y.y!.ticks.every((t) => t >= l.y.y!.scale.domain[0] && t <= l.y.y!.scale.domain[1]),
    ).toBe(true)
  })

  it('leaves room for the range strip: under the x axis, or down the right side', () => {
    const l = layoutChart({ ...base, strip: true })
    expect(l.strip).toEqual({ x: l.plot.x, y: 300 - 32, width: l.plot.width, height: 32 })
    expect(l.plot.y + l.plot.height).toBeLessThan(300 - 32 - 12 - 16)
    const across = layoutChart({ ...base, horizontal: true, strip: true })
    expect(across.strip).toMatchObject({ x: 600 - 32, width: 32, y: across.plot.y })
    expect(across.plot.x + across.plot.width).toBeLessThanOrEqual(600 - 32 - 12)
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
  ;(root.style as CSSStyleDeclaration).width = `${width}px`
  await settle()
  return { wrapper, root }
}

const settle = async () => {
  await new Promise((done) => setTimeout(done, 40))
  await nextTick()
}

const months = Array.from({ length: 12 }, (_, i) => ({ m: `${i + 1}月`, v: 10 + i * 3 }))
const ticks = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('.dou-chart__tick.is-bottom').map((tick) => tick.text())

/** Where the label of a category is centered, in px from the left. */
function middleOf(wrapper: ReturnType<typeof mount>, text: string): number {
  const tick = wrapper.findAll('.dou-chart__tick.is-bottom').find((t) => t.text() === text)!
  const el = tick.element as HTMLElement
  const left = Number(/translate\(([\d.]+)px/.exec(el.style.transform)![1])
  return left + 7
}

const key = (root: HTMLElement, name: string, init: KeyboardEventInit = {}) =>
  root.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, ...init }))

function pointer(
  root: HTMLElement,
  type: string,
  x: number,
  y: number,
  init: PointerEventInit = {},
) {
  root.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: 'mouse',
      button: type === 'pointermove' ? -1 : 0,
      ...init,
    }),
  )
}

async function drag(root: HTMLElement, from: [number, number], to: [number, number], init = {}) {
  pointer(root, 'pointerdown', ...from, init)
  for (let k = 1; k <= 4; k++)
    pointer(
      root,
      'pointermove',
      from[0] + ((to[0] - from[0]) * k) / 4,
      from[1] + ((to[1] - from[1]) * k) / 4,
      init,
    )
  await settle()
  pointer(root, 'pointerup', ...to, init)
  root.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: to[0], clientY: to[1] }))
  await settle()
}

describe('DouChartZoom', () => {
  it('shows the stretch it is given, and all of x for null', async () => {
    const range = ref<ChartInterval | null>(['3月', '5月'])
    const { wrapper } = await sized(() =>
      h(DouChart, { data: months, x: 'm' }, () => [
        h(DouChartBar, { y: 'v' }),
        h(DouChartZoom, { x: range.value }),
      ]),
    )
    expect(ticks(wrapper)).toEqual(['3月', '4月', '5月'])
    range.value = null
    await settle()
    expect(ticks(wrapper)).toHaveLength(12)
    wrapper.unmount()
  })

  it('zooms with + and -, shows all with 0, and reads it out', async () => {
    const range = ref<ChartInterval | null>(null)
    const { wrapper, root } = await sized(() =>
      h(DouChart, { data: months, x: 'm' }, () => [
        h(DouChartBar, { y: 'v' }),
        h(DouChartZoom, {
          x: range.value,
          'onUpdate:x': (v: ChartInterval | null) => (range.value = v),
        }),
      ]),
    )
    expect(root.getAttribute('aria-label')).toContain('加号和减号缩放')
    key(root, '+')
    await settle()
    expect(range.value).toEqual(['4月', '9月'])
    expect(wrapper.findAll('.dou-chart__live').map((l) => l.text())).toContain('显示 4月 至 9月')
    key(root, '-')
    await settle()
    expect(range.value).toBeNull()
    key(root, '+')
    key(root, '0')
    await settle()
    expect(range.value).toBeNull()
    expect(wrapper.findAll('.dou-chart__live').map((l) => l.text())).toContain('显示全部')
    wrapper.unmount()
  })

  it('pans when dragged, and the click after the drag is not a select', async () => {
    const range = ref<ChartInterval | null>(['1月', '4月'])
    const selected: unknown[] = []
    const { wrapper, root } = await sized(() =>
      h(DouChart, { data: months, x: 'm', onSelect: (e: unknown) => selected.push(e) }, () => [
        h(DouChartBar, { y: 'v' }),
        h(DouChartZoom, {
          x: range.value,
          'onUpdate:x': (v: ChartInterval | null) => (range.value = v),
        }),
      ]),
    )
    expect(root.classList.contains('is-zoomed')).toBe(true)
    // the plot is about 550px wide, four months: about 137px a month
    await drag(root, [400, 150], [130, 150])
    expect(range.value).toEqual(['3月', '6月'])
    expect(selected).toHaveLength(0)
    // a double click shows all
    root.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 300, clientY: 150 }))
    await settle()
    expect(range.value).toBeNull()
    wrapper.unmount()
  })

  it('pans a sliver of the range strip pressed by a finger in its middle', async () => {
    const days = Array.from({ length: 100 }, (_, x) => ({ x, v: x % 7 }))
    const range = ref<ChartInterval | null>([50, 53])
    const { wrapper, root } = await sized(() =>
      h(DouChart, { data: days, x: 'x' }, () => [
        h(DouChartBar, { y: 'v' }),
        h(DouChartZoom, {
          x: range.value,
          'onUpdate:x': (v: ChartInterval | null) => (range.value = v),
        }),
        h(DouChartRange),
      ]),
    )
    const strip = root.querySelector<HTMLElement>('.dou-chart__range')!
    const [, left, top] = /translate\(([\d.]+)px, ([\d.]+)px\)/
      .exec(strip.style.transform)!
      .map(Number)
    const width = parseFloat(strip.style.width)
    const height = parseFloat(strip.style.height)
    strip.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect
    const shown = root.querySelector<HTMLElement>('.dou-chart__range-window')!
    const [, from] = /translate\(([\d.]+)px/.exec(shown.style.transform)!.map(Number)
    const middle = left! + from! + parseFloat(shown.style.width) / 2
    // narrower than two fingertips: still the shown part, not a handle
    expect(parseFloat(shown.style.width)).toBeLessThan(24)
    const touch = { pointerType: 'touch' }
    const at = (type: string, x: number) =>
      strip.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          button: 0,
          clientX: x,
          clientY: top! + height / 2,
          ...touch,
        }),
      )
    // on a phone the handles drawn at its ends cover all of it: the press lands on one
    root.querySelectorAll('.dou-chart__range-handle')[1]!.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: middle,
        clientY: top! + height / 2,
        ...touch,
      }),
    )
    at('pointermove', middle - width / 4)
    at('pointerup', middle - width / 4)
    await settle()
    const [a, b] = range.value as [number, number]
    // the same few days, moved: not stretched or squeezed by a handle
    expect(b - a).toBeGreaterThanOrEqual(3)
    expect(b - a).toBeLessThanOrEqual(4)
    expect(a).toBeLessThan(40)
    wrapper.unmount()
  })

  it('zooms with the wheel only with Ctrl held, unless told to', async () => {
    const range = ref<ChartInterval | null>(null)
    const wheel = ref(false)
    const { wrapper, root } = await sized(() =>
      h(DouChart, { data: months, x: 'm' }, () => [
        h(DouChartBar, { y: 'v' }),
        h(DouChartZoom, {
          x: range.value,
          wheel: wheel.value,
          'onUpdate:x': (v: ChartInterval | null) => (range.value = v),
        }),
      ]),
    )
    const turn = (init: WheelEventInit) => {
      const event = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: init.deltaY ?? -100,
      })
      // happy-dom leaves these out of a wheel event
      const given = { clientX: 300, clientY: 150, ctrlKey: false, ...init }
      for (const [name, value] of Object.entries(given))
        Object.defineProperty(event, name, { value })
      root.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(turn({})).toBe(false)
    await settle()
    expect(range.value).toBeNull()
    expect(turn({ ctrlKey: true })).toBe(true)
    await settle()
    expect(range.value).not.toBeNull()
    range.value = null
    wheel.value = true
    await settle()
    // all shown: turning it out scrolls the page on
    expect(turn({ deltaY: 100 })).toBe(false)
    expect(turn({})).toBe(true)
    await settle()
    expect(range.value).not.toBeNull()
    wrapper.unmount()
  })

  it('follows the keys out of the stretch shown', async () => {
    const range = ref<ChartInterval | null>(['1月', '3月'])
    const { wrapper, root } = await sized(() =>
      h(DouChart, { data: months, x: 'm' }, () => [
        h(DouChartBar, { y: 'v' }),
        h(DouChartZoom, {
          x: range.value,
          'onUpdate:x': (v: ChartInterval | null) => (range.value = v),
        }),
      ]),
    )
    for (let i = 0; i < 4; i++) key(root, 'ArrowRight')
    await settle()
    expect(range.value).toEqual(['2月', '4月'])
    expect(wrapper.find('.dou-chart__tooltip-title').text()).toBe('4月')
    wrapper.unmount()
  })

  it('lets the page scroll the way it doesn’t pan', async () => {
    const range = ref<ChartInterval | null>(null)
    const { wrapper, root } = await sized(() =>
      h(DouChart, { data: months, x: 'm' }, () => [
        h(DouChartBar, { y: 'v' }),
        h(DouChartZoom, { x: range.value }),
      ]),
    )
    expect(root.style.touchAction).toBe('pan-x pan-y')
    range.value = ['2月', '5月']
    await settle()
    expect(root.style.touchAction).toBe('pan-y')
    wrapper.unmount()
  })
})

describe('DouChartBrush', () => {
  it('selects a stretch, gives its rows, and lets it go with Escape', async () => {
    const picked = ref<ChartInterval | null>(null)
    const events: Array<{ x?: ChartInterval; rows: unknown[] }> = []
    const { wrapper, root } = await sized(() =>
      h(DouChart, { data: months, x: 'm' }, () => [
        h(DouChartLine, { y: 'v', name: '销售额' }),
        h(DouChartBrush, {
          x: picked.value,
          'onUpdate:x': (v: ChartInterval | null) => (picked.value = v),
          onSelect: (e: (typeof events)[number]) => events.push(e),
        }),
      ]),
    )
    expect(root.classList.contains('is-brushing')).toBe(true)
    await drag(root, [middleOf(wrapper, '3月') - 12, 100], [middleOf(wrapper, '5月') + 12, 200])
    expect(picked.value).toEqual(['3月', '5月'])
    expect(events).toHaveLength(1)
    expect(events[0]!.rows.map((row) => (row as { m: string }).m)).toEqual(['3月', '4月', '5月'])
    expect(wrapper.find('.dou-chart__brush').exists()).toBe(true)
    root.focus()
    key(root, 'Escape')
    await settle()
    expect(picked.value).toBeNull()
    expect(wrapper.find('.dou-chart__brush').exists()).toBe(false)
    wrapper.unmount()
  })

  it('selects with Shift held when the chart also zooms', async () => {
    const picked = ref<ChartInterval | null>(null)
    const range = ref<ChartInterval | null>(['1月', '6月'])
    const { wrapper, root } = await sized(() =>
      h(DouChart, { data: months, x: 'm' }, () => [
        h(DouChartLine, { y: 'v' }),
        h(DouChartZoom, {
          x: range.value,
          'onUpdate:x': (v: ChartInterval | null) => (range.value = v),
        }),
        h(DouChartBrush, {
          x: picked.value,
          'onUpdate:x': (v: ChartInterval | null) => (picked.value = v),
        }),
      ]),
    )
    await drag(root, [150, 100], [400, 100], { shiftKey: true })
    expect(range.value).toEqual(['1月', '6月'])
    expect(picked.value).not.toBeNull()
    wrapper.unmount()
  })
})

/** Whether a touch moving now is kept from scrolling the page. */
function blocked() {
  const move = new Event('touchmove', { cancelable: true })
  window.dispatchEvent(move)
  return move.defaultPrevented
}

describe('review fixes', () => {
  it('tells the page when the selection is let go, and selects with Shift and the arrows', async () => {
    const picked = ref<ChartInterval | null>(null)
    const events: Array<{ x?: ChartInterval; rows: unknown[] }> = []
    const { wrapper, root } = await sized(() =>
      h(DouChart, { data: months, x: 'm' }, () => [
        h(DouChartLine, { y: 'v' }),
        h(DouChartBrush, {
          x: picked.value,
          'onUpdate:x': (v: ChartInterval | null) => (picked.value = v),
          onSelect: (e: (typeof events)[number]) => events.push(e),
        }),
      ]),
    )
    key(root, 'ArrowRight')
    key(root, 'ArrowRight', { shiftKey: true })
    key(root, 'ArrowRight', { shiftKey: true })
    await settle()
    expect(picked.value).toEqual(['1月', '3月'])
    expect(events.at(-1)!.rows).toHaveLength(3)
    key(root, 'Escape')
    key(root, 'Escape')
    await settle()
    expect(picked.value).toBeNull()
    expect(events.at(-1)).toEqual({ rows: [], series: [] })
    wrapper.unmount()
  })

  it('lets a finger scroll the page unless it moves the way the chart pans', async () => {
    const range = ref<ChartInterval | null>(null)
    const { wrapper, root } = await sized(() =>
      h(DouChart, { data: months, x: 'm' }, () => [
        h(DouChartBar, { y: 'v' }),
        h(DouChartZoom, {
          x: range.value,
          'onUpdate:x': (v: ChartInterval | null) => (range.value = v),
        }),
      ]),
    )
    const touch = { pointerType: 'touch', pointerId: 7 }
    // not zoomed: nothing to pan
    pointer(root, 'pointerdown', 300, 150, touch)
    pointer(root, 'pointermove', 300, 100, touch)
    expect(blocked()).toBe(false)
    pointer(root, 'pointerup', 300, 100, touch)
    range.value = ['2月', '5月']
    await settle()
    // zoomed along x: up and down still scrolls
    pointer(root, 'pointerdown', 300, 150, touch)
    pointer(root, 'pointermove', 302, 100, touch)
    expect(blocked()).toBe(false)
    pointer(root, 'pointerup', 302, 100, touch)
    // sideways pans
    pointer(root, 'pointerdown', 300, 150, touch)
    pointer(root, 'pointermove', 200, 152, touch)
    expect(blocked()).toBe(true)
    pointer(root, 'pointerup', 200, 152, touch)
    await settle()
    expect(range.value).not.toEqual(['2月', '5月'])
    wrapper.unmount()
  })

  it('gives numbers back no finer than a thousandth of the span', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ x: i * 1.37, v: Math.sin(i) * 10 }))
    const range = ref<ChartInterval | null>(null)
    const { wrapper, root } = await sized(() =>
      h(DouChart, { data: rows, x: 'x' }, () => [
        h(DouChartLine, { y: 'v' }),
        h(DouChartZoom, {
          x: range.value,
          'onUpdate:x': (v: ChartInterval | null) => (range.value = v),
        }),
      ]),
    )
    key(root, '+')
    await settle()
    for (const end of range.value!)
      expect(String(end).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2)
    wrapper.unmount()
  })

  it('takes the room for side labels it is given', () => {
    const model = buildModel([{ index: 0, kind: lineKind, props: { y: 'v' } as never }], {
      data: months,
      x: 'm',
    })
    const axes: ChartAxes = {
      x: { position: 'bottom', grid: false, hidden: false },
      y: { position: 'left', grid: true, hidden: false, labelWidth: 40 },
      y2: null,
    }
    const l = layoutChart({
      model,
      axes,
      width: 600,
      height: 300,
      locale: 'zh-CN',
      measure: () => 12,
    })
    expect(l.plot.x).toBe(4 + 40 + 8)
  })

  it('aims for the number of ticks given, on the values and on x', () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ x: i * 10, v: 140 * i }))
    const model = buildModel([{ index: 0, kind: lineKind, props: { y: 'v' } as never }], {
      data: rows,
      x: 'x',
    })
    const layout = (count?: number) =>
      layoutChart({
        model,
        axes: {
          x: { position: 'bottom', grid: false, hidden: false, ticks: count },
          y: { position: 'left', grid: true, hidden: false, ticks: count },
          y2: null,
        },
        width: 800,
        height: 400,
        locale: 'zh-CN',
        measure: () => 12,
      })
    const many = layout()
    const few = layout(3)
    expect(many.y.y!.ticks.length).toBeGreaterThan(4)
    // 0 to 1400 in steps of 500: the top of the axis is a tick
    expect(few.y.y!.ticks).toEqual([0, 500, 1000, 1500])
    expect(few.y.y!.scale.domain).toEqual([0, 1500])
    expect(few.x.ticks.length).toBeLessThanOrEqual(4)
    expect(many.x.ticks.length).toBeGreaterThan(few.x.ticks.length)
  })
})

describe('DouChartRange', () => {
  it('shows the part of x shown between two sliders, moved with the keys', async () => {
    const range = ref<ChartInterval | null>(null)
    const { wrapper } = await sized(() =>
      h(DouChart, { data: months, x: 'm' }, () => [
        h(DouChartBar, { y: 'v' }),
        h(DouChartRange, {
          modelValue: range.value,
          'onUpdate:modelValue': (v: ChartInterval | null) => (range.value = v),
        }),
      ]),
    )
    const handles = wrapper.findAll('[role="slider"]')
    expect(handles.map((handle) => handle.attributes('aria-label'))).toEqual([
      '区间起点',
      '区间终点',
    ])
    expect(handles[1]!.attributes('aria-valuetext')).toBe('12月')
    await handles[1]!.trigger('keydown', { key: 'ArrowLeft' })
    await handles[1]!.trigger('keydown', { key: 'ArrowLeft' })
    await settle()
    expect(range.value).toEqual(['1月', '10月'])
    expect(wrapper.findAll('[role="slider"]')[1]!.attributes('aria-valuetext')).toBe('10月')
    await handles[0]!.trigger('keydown', { key: 'End' })
    await settle()
    // never narrower than one month
    expect(range.value).toEqual(['10月', '10月'])
    wrapper.unmount()
  })
})
