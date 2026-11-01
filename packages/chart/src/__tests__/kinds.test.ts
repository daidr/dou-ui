import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import {
  DouChart,
  DouChartBoxplot,
  DouChartGauge,
  DouChartHistogram,
  DouChartSunburst,
  DouChartTreemap,
  DouChartWaterfall,
} from '..'
import { boxStats } from '../core/box'
import { histogramBins } from '../core/histogram'
import type { ChartData } from '../core/data'
import type { Painter } from '../core/painter'
import { CHART_PATTERNS, fillPattern, patternCss } from '../core/pattern'
import {
  buildTree,
  layoutSunburst,
  layoutTreemap,
  sunburstAt,
  treemapAt,
  treePath,
} from '../core/tree'
import { waterfallSteps } from '../core/waterfall'

/** What a screen reader reads for the chart. */
async function summaryOf(props: Record<string, unknown>, part: () => unknown) {
  const wrapper = mount(DouChart, {
    props,
    slots: { default: () => [part()] },
    attachTo: document.body,
  })
  await nextTick()
  await nextTick()
  const text = wrapper.find('.dou-chart').attributes('aria-label') ?? ''
  wrapper.unmount()
  return text
}

/** The table a chart lists its data in. */
async function tableOf(props: Record<string, unknown>, part: () => unknown) {
  const wrapper = mount(DouChart, {
    props: { table: true, ...props },
    slots: { default: () => [part()] },
    attachTo: document.body,
  })
  await nextTick()
  await nextTick()
  const cells = wrapper
    .findAll('.dou-chart__table tr')
    .map((tr) => tr.findAll('th, td').map((c) => c.text()))
  wrapper.unmount()
  return cells
}

describe('waterfall', () => {
  it('floats each change from the running total, and totals from 0', () => {
    const rows = [{ v: 10 }, { v: -4 }, { t: true }, { v: null }, { v: 3 }, { t: true }]
    const { y, top, base } = waterfallSteps(
      rows,
      new Float64Array([10, -4, Number.NaN, Number.NaN, 3, Number.NaN]),
      't',
    )
    expect([...base]).toEqual([0, 10, 0, Number.NaN, 6, 0])
    expect([...top]).toEqual([10, 6, 6, Number.NaN, 9, 9])
    expect([...y]).toEqual([10, -4, 6, Number.NaN, 3, 9])
  })

  it('writes each change with its sign and the total after it', async () => {
    const rows = [
      { k: '收入', v: 1200 },
      { k: '成本', v: -500 },
      { k: '利润', total: true },
    ]
    const cells = await tableOf({ data: rows, x: 'k' }, () =>
      h(DouChartWaterfall, { y: 'v', total: 'total', name: '金额' }),
    )
    expect(cells.slice(1)).toEqual([
      ['收入', '+1,200，累计 1,200'],
      ['成本', '-500，累计 700'],
      ['利润', '700'],
    ])
  })
})

describe('histogram', () => {
  it('counts values into round bins, the last including its end', () => {
    const bins = histogramBins([0.5, 1, 1.5, 2, 2.5, 3, 10], { count: 5 })
    expect(bins[0]!.x0).toBe(0)
    expect(bins.at(-1)!.x1).toBe(10)
    expect(bins.reduce((sum, b) => sum + b.count, 0)).toBe(7)
    // equal widths, edge to edge
    for (let k = 1; k < bins.length; k++) expect(bins[k]!.x0).toBe(bins[k - 1]!.x1)
    expect(histogramBins([0.1, 0.2, 0.3], { step: 0.1 }).map((b) => b.x0)).toEqual([0.1, 0.2])
    expect(histogramBins([])).toEqual([])
    expect(histogramBins([4, 4, 4])).toEqual([{ x0: 4, x1: 5, x: 4.5, count: 3 }])
  })

  it('widens bins past the most it draws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const bins = histogramBins([0, 1e6], { step: 1 })
    expect(bins.length).toBeLessThanOrEqual(1000)
    expect(bins.reduce((sum, b) => sum + b.count, 0)).toBe(2)
    warn.mockRestore()
  })

  it('titles each bin by its range in the table', async () => {
    const rows = [1, 2, 2, 3, 7].map((v) => ({ v }))
    const cells = await tableOf({ data: rows }, () => h(DouChartHistogram, { value: 'v', step: 5 }))
    expect(cells.slice(1).map((row) => row.at(-1))).toEqual(['4', '1'])
    expect(cells.slice(1).map((row) => row[0])).toEqual(['0 – 5', '5 – 10'])
  })

  it('reads out its bins and the range they cover', async () => {
    const rows = [2, 3, 7, 14].map((v) => ({ v }))
    const text = await summaryOf({ data: rows }, () =>
      h(DouChartHistogram, { value: 'v', step: 5, name: '次数' }),
    )
    expect(text).toContain('横轴从 0 到 15')
    expect(text).toContain('次数：3 个区间，最少 1，最多 2')
  })
})

describe('box plot', () => {
  it('sums a group up in quartiles, whiskers and outliers', () => {
    const box = boxStats([1, 2, 3, 4, 5, 6, 7, 8, 100])!
    expect(box.median).toBe(5)
    expect(box.q1).toBe(3)
    expect(box.q3).toBe(7)
    expect(box.low).toBe(1)
    expect(box.high).toBe(8)
    expect(box.outliers).toEqual([100])
    expect(boxStats([1, 2, 100], Infinity)!.outliers).toEqual([])
    expect(boxStats(['a', null])).toBeNull()
  })

  it('reads each box out in one line', async () => {
    const cells = await tableOf({ data: [{ k: '徐汇', v: [1, 2, 3, 4, 5] }], x: 'k' }, () =>
      h(DouChartBoxplot, { y: 'v', name: '营业额' }),
    )
    expect(cells[1]).toEqual(['徐汇', '中位数 3，四分位 2 ~ 4，范围 1 ~ 5'])
  })

  it('reads out its groups, from the lowest value to the highest', async () => {
    const data = [
      { k: '徐汇', v: [1, 2, 3, 4, 5, 6, 7, 8, 100] },
      { k: '静安', v: [2, 3, 4] },
    ]
    const text = await summaryOf({ data, x: 'k' }, () =>
      h(DouChartBoxplot, { y: 'v', name: '营业额' }),
    )
    expect(text).toContain('营业额：2 组，最小 1，最大 100')
    const cells = await tableOf({ data, x: 'k' }, () => h(DouChartBoxplot, { y: 'v' }))
    expect(cells[1]![1]).toContain('异常值 1 个')
  })
})

describe('gauge', () => {
  it('lists its value', async () => {
    const cells = await tableOf({}, () =>
      h(DouChartGauge, { value: 72, name: '完成率', format: (v: number) => `${v}%` }),
    )
    expect(cells).toEqual([['完成率'], ['72%']])
  })
})

const tree = [
  {
    name: '徐汇',
    children: [
      { name: '徐家汇', value: 6 },
      { name: '漕河泾', value: 2 },
    ],
  },
  { name: '静安', value: 2 },
  { name: '空', value: 0 },
]

describe('trees', () => {
  it('reads nested rows, summing groups and leaving out what has no value', () => {
    const { root, nodes } = buildTree(tree, { label: 'name', value: 'value', children: 'children' })
    expect(root.value).toBe(10)
    expect(nodes.map((n) => n.name)).toEqual(['', '徐汇', '徐家汇', '漕河泾', '静安'])
    expect(nodes.map((n) => n.group)).toEqual([-1, 0, 0, 0, 1])
    expect(treePath(nodes[3]!)).toEqual(['徐汇', '漕河泾'])
  })

  it('lays a treemap out with areas by value', () => {
    const { root, nodes } = buildTree(tree, { label: 'name', value: 'value', children: 'children' })
    layoutTreemap(root, { x: 0, y: 0, width: 200, height: 100 })
    const area = (n: (typeof nodes)[number]) => (n.x1 - n.x0) * (n.y1 - n.y0)
    expect(area(nodes[1]!) / area(nodes[4]!)).toBeCloseTo(4)
    // children inside their group
    for (const child of nodes[1]!.children) {
      expect(child.x0).toBeGreaterThanOrEqual(nodes[1]!.x0)
      expect(child.y1).toBeLessThanOrEqual(nodes[1]!.y1)
    }
    const leaf = nodes[2]!
    expect(treemapAt(root, (leaf.x0 + leaf.x1) / 2, (leaf.y0 + leaf.y1) / 2)).toBe(leaf)
  })

  it('lays a sunburst out in rings, arcs by value', () => {
    const { root, nodes } = buildTree(tree, { label: 'name', value: 'value', children: 'children' })
    layoutSunburst(root, 20, 100)
    expect(nodes[1]!.x1 - nodes[1]!.x0).toBeCloseTo(Math.PI * 2 * 0.8)
    expect([nodes[1]!.y0, nodes[1]!.y1]).toEqual([20, 60])
    expect([nodes[2]!.y0, nodes[2]!.y1]).toEqual([60, 100])
    expect(sunburstAt(root, 0.1, 80)).toBe(nodes[2])
    expect(sunburstAt(root, 0.1, 10)).toBeNull()
  })

  it('lists every node with its path and share', async () => {
    const cells = await tableOf({ data: tree }, () => h(DouChartTreemap, { name: '营业额' }))
    expect(cells[0]).toEqual(['节点', '营业额', '占比'])
    expect(cells[3]).toEqual(['徐汇 / 漕河泾', '2', '20%'])
    const rings = await tableOf({ data: tree }, () => h(DouChartSunburst))
    expect(rings).toHaveLength(5)
  })
})

describe('patterns', () => {
  it('draws each pattern clipped to the shape', () => {
    for (const pattern of CHART_PATTERNS) {
      const calls: string[] = []
      const painter = new Proxy({} as Record<string, unknown>, {
        get: (target, key: string) => (key in target ? target[key] : () => calls.push(key)),
        set: (target, key: string, value) => {
          target[key] = value
          return true
        },
      }) as unknown as Painter
      painter.globalAlpha = 1
      fillPattern(painter, pattern, { x: 0, y: 0, width: 30, height: 20 }, '#fff')
      expect(calls[1]).toBe('clip')
      expect(calls).toContain(pattern === 'dots' ? 'fill' : 'stroke')
      expect(calls.at(-1)).toBe('restore')
      expect(patternCss(pattern, '#fff').image).toMatch(/gradient/)
    }
  })
})

/** A chart rendered as on the server: nothing of a page there. */
async function serverHtml(part: () => unknown, data?: ChartData) {
  for (const name of ['window', 'document', 'Element', 'HTMLElement', 'HTMLCanvasElement', 'Node'])
    vi.stubGlobal(name, undefined)
  try {
    return await renderToString(h(DouChart, { data, height: 240, ssrWidth: 480 }, () => [part()]))
  } finally {
    vi.unstubAllGlobals()
  }
}

describe('on the server', () => {
  it('draws a treemap, a sunburst and a gauge into the SVG', async () => {
    for (const html of [
      await serverHtml(() => h(DouChartTreemap), tree),
      await serverHtml(() => h(DouChartSunburst), tree),
      await serverHtml(() => h(DouChartGauge, { value: 40 })),
    ]) {
      expect(html).toContain('<svg class="dou-chart__static"')
      expect(html).toMatch(/<path [^>]*d="M/)
    }
  })
})
