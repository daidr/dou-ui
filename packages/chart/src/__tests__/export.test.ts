import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { DouChart, DouChartAxis, DouChartLine, DouChartMarker, DouChartPie } from '..'
import { drawMarkers, placeMarkers, type MarkerInput } from '../core/marker'
import { categoryScale, linearScale } from '../core/scale'
import { SvgPainter } from '../core/svg'
import type { ChartExpose } from '../types'

describe('SvgPainter', () => {
  it('writes paths with the state they were drawn in', () => {
    const svg = new SvgPainter('t-')
    svg.save()
    svg.beginPath()
    svg.moveTo(0, 0)
    svg.lineTo(10, 5.555)
    svg.strokeStyle = '#123456'
    svg.lineWidth = 2
    svg.lineJoin = 'round'
    svg.setLineDash([4, 3])
    svg.globalAlpha = 0.5
    svg.stroke()
    svg.restore()
    svg.beginPath()
    svg.rect(1, 2, 3, 4)
    svg.fillStyle = 'var(--dou-color-chart-1)'
    svg.fill()
    expect(svg.markup()).toBe(
      '<path d="M0 0L10 5.56" fill="none" stroke="#123456" stroke-width="2" stroke-linejoin="round" stroke-dasharray="4 3" opacity="0.5"/>' +
        // a theme variable can't be an attribute: it goes in a style
        '<path d="M1 2h3v4h-3Z" style="fill:var(--dou-color-chart-1)"/>',
    )
  })

  it('draws a whole circle as two arcs, from the current point', () => {
    const svg = new SvgPainter('t-')
    svg.beginPath()
    svg.moveTo(14, 10)
    svg.arc(10, 10, 4, 0, Math.PI * 2)
    svg.fill()
    expect(svg.markup()).toContain('d="M14 10L14 10A4 4 0 0 1 6 10A4 4 0 0 1 14 10"')
  })

  it('draws part of a circle the way a canvas does, either way round', () => {
    const svg = new SvgPainter('t-')
    svg.beginPath()
    svg.arc(0, 0, 10, 0, Math.PI / 2)
    svg.arc(0, 0, 10, Math.PI / 2, 0, true)
    svg.stroke()
    // a quarter clockwise (sweep 1), then back the same quarter (sweep 0)
    expect(svg.markup()).toContain('d="M10 0A10 10 0 0 1 0 10L0 10A10 10 0 0 0 10 0"')
  })

  it('rounds a corner with arcTo', () => {
    const svg = new SvgPainter('t-')
    svg.beginPath()
    svg.moveTo(0, 0)
    svg.arcTo(10, 0, 10, 10, 4)
    svg.stroke()
    expect(svg.markup()).toContain('d="M0 0L6 0A4 4 0 0 1 10 4"')
  })

  it('clips within the clip before, and forgets it on restore', () => {
    const svg = new SvgPainter('t-')
    svg.save()
    svg.beginPath()
    svg.rect(0, 0, 10, 10)
    svg.clip()
    svg.beginPath()
    svg.rect(2, 2, 6, 6)
    svg.clip()
    svg.fill()
    svg.restore()
    svg.fill()
    const markup = svg.markup()
    expect(markup).toContain('<clipPath id="t-c0"><path d="M0 0h10v10h-10Z"/></clipPath>')
    expect(markup).toContain('<clipPath id="t-c1" clip-path="url(#t-c0)">')
    expect(markup).toContain('clip-path="url(#t-c1)"/>')
    expect(markup.endsWith('<path d="M2 2h6v6h-6Z" fill="#000"/>')).toBe(true)
  })

  it('draws a faded layer as a group and escapes text', () => {
    const svg = new SvgPainter('t-', (css) => (css === 'red' ? '#ff0000' : css))
    svg.layer(0.25, () => {
      svg.beginPath()
      svg.rect(0, 0, 1, 1)
      svg.fillStyle = 'red'
      svg.fill()
    })
    expect(svg.markup()).toBe('<g opacity="0.25"><path d="M0 0h1v1h-1Z" fill="#ff0000"/></g>')
  })
})

const measure = (text: string) => text.length * 7
const colors = () => ({ line: '#111', dot: '#222', fill: '#333', surface: '#fff' })

describe('markers', () => {
  const plot = { x: 40, y: 10, width: 400, height: 200 }
  const x = linearScale([0, 100], [40, 440])
  const y = linearScale([0, 50], [210, 10])
  const place = (markers: Array<Partial<MarkerInput>>, horizontal = false) =>
    placeMarkers(
      markers.map((m) => ({ x: null, y: null, axis: 'y', tone: 'neutral', solid: false, ...m })),
      {
        plot,
        x: horizontal ? linearScale([0, 100], [10, 210]) : x,
        y: () => (horizontal ? linearScale([0, 50], [40, 440]) : y),
        horizontal,
        measure,
      },
    )

  it('places lines, bands and points from the scales', () => {
    const [line, band, point] = place([{ y: 25 }, { x: [10, 20] }, { x: 50, y: 25 }])
    expect(line!.shape).toEqual({ kind: 'line', vertical: false, at: 110, from: 40, to: 440 })
    expect(band!.shape).toEqual({ kind: 'area', x: 80, y: 10, width: 40, height: 200 })
    expect(point!.shape).toEqual({ kind: 'point', x: 240, y: 110 })
  })

  it('turns with a horizontal chart: an x is a line across', () => {
    const [line] = place([{ x: 50 }], true)
    expect(line!.shape).toEqual({ kind: 'line', vertical: false, at: 110, from: 40, to: 440 })
  })

  it('leaves out what is off the plot, and cuts bands at its edge', () => {
    const placed = place([{ y: 80 }, { x: [90, 150] }])
    expect(placed).toHaveLength(1)
    expect(placed[0]!.shape).toEqual({ kind: 'area', x: 400, y: 10, width: 40, height: 200 })
  })

  it('puts labels by the line, before it near the right edge, and keeps them in the plot', () => {
    const [across, down, nearEnd, top] = place([
      { y: 25, label: '目标' },
      { x: 10, label: '上线' },
      { x: 98, label: '上线' },
      { x: 50, y: 50, label: '峰值' },
    ])
    expect(across!.label).toEqual({ text: '目标', left: 436, top: 92, align: 'end' })
    expect(down!.label).toEqual({ text: '上线', left: 84, top: 10, align: 'start' })
    expect(nearEnd!.label!.align).toBe('end')
    // a point at the top (a peak): its label goes beside it
    expect(top!.label).toEqual({ text: '峰值', left: 248, top: 2, align: 'start' })
  })

  it('moves a label off another one', () => {
    // a line near the right edge: its label goes before it, at the top, where the target's is
    const [target, launch] = place([
      { y: 46, label: '目标' },
      { x: 98, label: '上线' },
    ])
    expect(target!.label).toMatchObject({ top: 8, align: 'end' })
    expect(launch!.label).toMatchObject({ top: 28, align: 'end' })
  })

  it('draws bands under the series and the rest over them', () => {
    const placed = place([{ y: 25 }, { y: [10, 20] }])
    const under = new SvgPainter('u-')
    drawMarkers(under, placed, colors, 1, true)
    expect(under.markup()).toBe('<path d="M40 130h400v40h-400Z" fill="#333"/>')
    const over = new SvgPainter('o-')
    drawMarkers(over, placed, colors, 1, false)
    expect(over.markup()).toContain('d="M40 110.5L440 110.5" fill="none" stroke="#111"')
    expect(over.markup()).toContain('stroke-dasharray="4 3"')
  })

  it('reads category markers as whole categories', () => {
    const scale = categoryScale(['a', 'b', 'c', 'd'], [40, 440])
    const placed = placeMarkers(
      [{ x: [0.5, 2.5], y: null, axis: 'y', tone: 'primary', solid: true }],
      {
        plot,
        x: scale,
        y: () => y,
        horizontal: false,
        measure,
      },
    )
    expect(placed[0]!.shape).toEqual({ kind: 'area', x: 140, y: 10, width: 200, height: 200 })
  })
})

const rows = [
  { m: '一月', a: 10 },
  { m: '二月', a: 30 },
  { m: '三月', a: 20 },
]

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

describe('DouChartMarker', () => {
  it('shows its label over the chart and widens the axis to reach it', async () => {
    const wrapper = await sized(() => [
      h(DouChartLine, { y: 'a' }),
      h(DouChartMarker, { y: 60, label: '目标', tone: 'success' }),
      h(DouChartMarker, { x: '二月', label: '上线' }),
    ])
    const labels = wrapper.findAll('.dou-chart__marker')
    expect(labels.map((l) => l.text())).toEqual(['目标', '上线'])
    expect(labels[0]!.classes()).toContain('is-success')
    // the data reach 30; the target at 60 is on the axis
    expect(wrapper.findAll('.dou-chart__tick').map((t) => t.text())).toContain('60')
    wrapper.unmount()
  })
})

describe('exporting', () => {
  it('gives the chart as an SVG with its text', async () => {
    const wrapper = await sized(() => [
      h(DouChartAxis, { for: 'y', title: '数量' }),
      h(DouChartLine, { y: 'a', name: '数量' }),
      h(DouChartLine, { y: (row: { a: number }) => row.a / 2, name: '一半', dashed: true }),
      h(DouChartMarker, { y: 25, label: '目标' }),
    ])
    const svg = (wrapper.vm as unknown as ChartExpose).exportSVG()
    // 16px of room around it, by default
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="632" height="332"')).toBe(
      true,
    )
    expect(svg).toContain('<g transform="translate(16 16)">')
    expect(svg).toContain('<title>图表，横轴从 一月 到 三月')
    // the series, the axis' ticks and title, the legend and the marker's label
    expect(svg).toMatch(/<path d="M[\d. ]+L/)
    for (const text of ['>一月<', '>三月<', '>数量<', '>一半<', '>目标<'])
      expect(svg).toContain(text)
    // a dashed line's swatch is two short strokes
    expect(svg.match(/height="2" rx="0"/g)).toHaveLength(2)
    const bare = (wrapper.vm as unknown as ChartExpose).exportSVG({ background: false, padding: 0 })
    expect(bare).toContain('width="600" height="300"')
    expect(bare).not.toContain('<rect width="600" height="300"')
    wrapper.unmount()
  })

  it('exports a pie', async () => {
    const wrapper = await sized(() => h(DouChartPie, { value: 'a' }))
    const svg = (wrapper.vm as unknown as ChartExpose).exportSVG()
    expect(svg.match(/<path /g)!.length).toBeGreaterThanOrEqual(3)
    wrapper.unmount()
  })
})

describe('loading', () => {
  it('shows a spinner, in place of the empty message', async () => {
    const wrapper = await sized(() => h(DouChartLine, { y: 'a' }), { data: [], loading: true })
    expect(wrapper.find('.dou-chart').classes()).toContain('is-loading')
    expect(wrapper.find('.dou-chart').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.dou-chart__loading').exists()).toBe(true)
    expect(wrapper.find('.dou-chart__empty').exists()).toBe(false)
    await wrapper.setProps({ loading: false })
    expect(wrapper.find('.dou-chart__empty').text()).toBe('没有数据')
    wrapper.unmount()
  })
})

describe('on the server', () => {
  afterEach(() => vi.unstubAllGlobals())

  const App = defineComponent(
    () => () =>
      h(DouChart, { data: rows, x: 'm', height: 240, ssrWidth: 480 }, () => [
        h(DouChartLine, { y: 'a', name: '数量' }),
        h(DouChartMarker, { y: 25, label: '目标' }),
      ]),
  )

  async function serverHtml() {
    // nothing of a page: as on the server
    for (const name of [
      'window',
      'document',
      'Element',
      'HTMLElement',
      'HTMLCanvasElement',
      'Node',
    ])
      vi.stubGlobal(name, undefined)
    try {
      return await renderToString(h(App))
    } finally {
      vi.unstubAllGlobals()
    }
  }

  it('draws the chart as an SVG at ssrWidth, with its labels as text', async () => {
    const html = await serverHtml()
    expect(html).toContain('<svg class="dou-chart__static"')
    expect(html).toContain('viewBox="0 0 480 240"')
    // its text is in it; the page's own labels wait for the browser
    expect(html).toMatch(/<text [^>]*>一月<\/text>/)
    expect(html).not.toContain('dou-chart__tick')
    // colors stay theme variables, so the drawing follows the theme
    expect(html).toContain('style="stroke:var(--dou-color-chart-1)"')
    expect(html).toContain('aria-label="图表，横轴从 一月 到 三月')
    expect(html).toContain('目标')
    expect(html).toContain('一月')
    expect(html).not.toContain('没有数据')
  })

  it('is taken over in the browser without a mismatch', async () => {
    const html = await serverHtml()
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const warnings: string[] = []
    const warn = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      warnings.push(args.map(String).join(' '))
    })
    const error = vi.spyOn(console, 'error').mockImplementation((...args) => {
      warnings.push(args.map(String).join(' '))
    })
    createSSRApp(App).mount(container)
    // the server's drawing stays until the canvas has drawn
    expect(container.querySelector('.dou-chart__static path')).not.toBeNull()
    await nextTick()
    warn.mockRestore()
    error.mockRestore()
    expect(warnings.filter((w) => /hydration|mismatch/i.test(w))).toEqual([])
    container.remove()
  })
})
