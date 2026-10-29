import { createSSRApp, h } from 'vue'
import type { Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as DouUI from '../index'

// Props a component cannot render without, or that open its overlay so
// the server also renders what is behind it.
const props: Record<string, Record<string, unknown>> = {
  DouAnchor: { items: [{ href: '#a', title: 'A', children: [{ href: '#b', title: 'B' }] }] },
  DouBreadcrumb: { items: [{ label: '首页' }] },
  DouCascader: { options: [{ value: 'a', label: 'A' }], modelValue: ['a'] },
  DouCommand: { items: [{ value: 'a', label: 'A' }] },
  DouCommandDialog: { items: [{ value: 'a', label: 'A' }], open: true },
  DouCopyButton: { text: 'npm i dou-ui' },
  DouDialog: { open: true, title: '标题' },
  DouDrawer: { open: true, title: '标题' },
  DouDropdown: { items: [{ key: 'a', label: 'A' }] },
  DouFlowGraph: {
    nodes: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    edges: [{ from: 'a', to: 'b' }],
    zoomable: true,
    legend: true,
  },
  DouImage: { src: 'a.png', preview: true },
  DouImagePreview: { open: true, images: ['a.png'] },
  DouListbox: { options: ['a', { label: '组', options: ['b'] }], modelValue: 'a' },
  DouLoading: { loading: true, text: '加载中' },
  DouMenu: { items: [{ key: 'a', label: 'A', children: [{ key: 'b', label: 'B' }] }] },
  DouPagination: { total: 100 },
  DouPopover: { open: true, content: '内容' },
  DouQrcode: { value: 'https://ui.daidr.me', status: 'expired' },
  DouSegmentedControl: { options: ['a', 'b'] },
  DouSelect: { options: [{ value: 'a', label: 'A' }] },
  DouSortable: { modelValue: [{ id: 1 }, { id: 2 }] },
  DouSteps: { items: [{ title: 'A' }] },
  DouTable: { columns: [{ key: 'a', title: 'A' }], data: [{ a: 1 }] },
  DouTabs: { items: [{ key: 'a', label: 'A' }] },
  DouTimeline: { items: [{ title: 'A' }] },
  DouTooltip: { open: true, content: '提示' },
  DouTransfer: { data: [{ key: 1, label: 'A' }] },
  DouTree: { data: [{ key: 'a', label: 'A' }] },
  DouTreeSelect: { data: [{ key: 'a', label: 'A' }], modelValue: 'a' },
  DouVirtualList: { items: [1, 2, 3], itemSize: 32 },
}

const components = (Object.entries(DouUI) as [string, unknown][]).filter(
  (entry): entry is [string, Component] =>
    entry[0].startsWith('Dou') &&
    entry[0] !== 'DouUI' &&
    typeof entry[1] === 'object' &&
    entry[1] !== null &&
    ('setup' in entry[1] || 'render' in entry[1]),
)

const make = (name: string, component: Component, open = true) => {
  const { open: _, ...closed } = props[name] ?? {}
  const app = createSSRApp({
    render: () => h(component, open ? (props[name] ?? {}) : closed, { default: () => '内容' }),
  })
  app.use(DouUI.DouUI)
  return app
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('server rendering', () => {
  // Overlays rendered open, so the server also renders what is teleported.
  it.each(components)('%s renders without a browser', async (name, component) => {
    const context: { teleports?: Record<string, string> } = {}
    const html = await renderToString(make(name, component), context)
    expect(html + Object.values(context.teleports ?? {}).join('')).not.toBe('')
  })

  // The browser then takes the page over. Anything that renders
  // differently on the two sides shows up as a hydration mismatch.
  // Overlays start closed here: an overlay open on first paint is rare,
  // and how teleported markup is put back is up to the host page.
  it.each(components)('%s hydrates what the server rendered', async (name, component) => {
    const html = await renderToString(make(name, component, false))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const root = document.createElement('div')
    root.innerHTML = html
    document.body.append(root)
    const app = make(name, component, false)
    app.mount(root)
    const problems = [...warn.mock.calls, ...error.mock.calls]
      .map((args) => String(args[0]))
      .filter((message) => /hydration|mismatch/i.test(message))
    expect(problems).toEqual([])
    app.unmount()
  })
})
