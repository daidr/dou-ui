import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { DouNodeGraph, DouNodeGraphLegend } from '../../../index'
import type { GraphEdge, GraphNode } from '../node-graph'

const nodes: GraphNode[] = [
  { id: 'a', label: '需求', status: 'finish' },
  { id: 'b', label: '设计', status: 'process' },
  { id: 'c', label: '开发', status: 'process', progress: 40 },
  { id: 'd', label: '上线', kind: 'milestone', incomplete: true },
  { id: 'e', label: '旁支', disabled: true },
]
const edges: GraphEdge[] = [
  { from: 'a', to: 'b' },
  { from: 'a', to: 'c' },
  { from: 'b', to: 'd' },
  { from: 'c', to: 'd' },
]

const find = (wrapper: ReturnType<typeof mount>, label: string) =>
  wrapper.findAll('.dou-node-graph__node').find((n) => n.text().includes(label))!

describe('DouNodeGraph', () => {
  it('renders nodes with their status, kind, progress and marker', () => {
    const wrapper = mount(DouNodeGraph, { props: { nodes, edges } })
    expect(wrapper.findAll('.dou-node-graph__node')).toHaveLength(5)
    expect(wrapper.findAll('.dou-node-graph__edge')).toHaveLength(4)
    expect(find(wrapper, '需求').classes()).toContain('is-finish')
    expect(find(wrapper, '上线').classes()).toContain('is-milestone')
    expect(find(wrapper, '上线').find('.dou-node-graph__marker').exists()).toBe(true)
    expect(
      find(wrapper, '开发').find('.dou-node-graph__progress-bar').attributes('style'),
    ).toContain('width: 40%')
    expect(wrapper.attributes('role')).toBe('group')
    expect(wrapper.attributes('aria-label')).toBe('节点图')
  })

  it('describes each node for screen readers', () => {
    const wrapper = mount(DouNodeGraph, { props: { nodes, edges } })
    expect(find(wrapper, '开发').attributes('aria-label')).toBe('开发，进行中，进度 40%，依赖 需求')
    expect(find(wrapper, '上线').attributes('aria-label')).toBe(
      '上线，里程碑，未开始，含未完成子任务，依赖 设计，开发',
    )
  })

  it('turns a node with progress into a card unless told otherwise', () => {
    const wrapper = mount(DouNodeGraph, {
      props: {
        nodes: [
          { id: 'a', label: 'A', progress: 50 },
          { id: 'b', label: 'B', progress: 50, shape: 'pill' },
        ],
        edges: [],
      },
    })
    expect(find(wrapper, 'A').classes()).toContain('dou-node-graph__node--card')
    expect(find(wrapper, 'B').classes()).toContain('dou-node-graph__node--pill')
  })

  it('turns a node with a description into a card', () => {
    const wrapper = mount(DouNodeGraph, {
      props: {
        nodes: [{ id: 'a', label: 'A', description: '说明', descriptionTone: 'danger' }],
        edges: [],
      },
    })
    const node = wrapper.find('.dou-node-graph__node')
    expect(node.classes()).toContain('dou-node-graph__node--card')
    expect(node.find('.dou-node-graph__description').classes()).toContain(
      'dou-node-graph__description--danger',
    )
  })

  it('works out blocked nodes', async () => {
    const wrapper = mount(DouNodeGraph, {
      props: { nodes, edges: [...edges, { from: 'b', to: 'c' }] },
    })
    expect(find(wrapper, '开发').classes()).toContain('is-process')
    await wrapper.setProps({ autoBlocked: true })
    // 设计 is still in progress
    expect(find(wrapper, '开发').classes()).toContain('is-blocked')
    expect(find(wrapper, '设计').classes()).toContain('is-process')
  })

  it('selects one node, or several, but not a disabled one', async () => {
    const wrapper = mount(DouNodeGraph, { props: { nodes, edges } })
    await find(wrapper, '设计').trigger('click')
    expect(wrapper.emitted('update:selected')!.at(-1)).toEqual(['b'])
    expect(wrapper.emitted('nodeClick')).toHaveLength(1)
    await wrapper.setProps({ selected: 'b' })
    expect(find(wrapper, '设计').classes()).toContain('is-selected')
    expect(find(wrapper, '设计').attributes('aria-pressed')).toBe('true')

    await find(wrapper, '旁支').trigger('click')
    expect(wrapper.emitted('update:selected')).toHaveLength(1)

    await wrapper.setProps({ selectable: 'multiple', selected: ['b'] })
    await find(wrapper, '开发').trigger('click')
    expect(wrapper.emitted('update:selected')!.at(-1)).toEqual([['b', 'c']])
  })

  it('fades everything off the hovered chain', async () => {
    const wrapper = mount(DouNodeGraph, { props: { nodes, edges } })
    await find(wrapper, '设计').trigger('pointerenter')
    expect(wrapper.emitted('update:hovered')!.at(-1)).toEqual(['b'])
    expect(wrapper.emitted('nodeEnter')![0]![0]).toMatchObject({ id: 'b' })
    await wrapper.setProps({ hovered: 'b' })
    expect(find(wrapper, '开发').classes()).toContain('is-dimmed')
    expect(find(wrapper, '需求').classes()).not.toContain('is-dimmed')
    expect(find(wrapper, '上线').classes()).not.toContain('is-dimmed')
    expect(wrapper.findAll('.dou-node-graph__edge.is-active')).toHaveLength(2)

    await wrapper.setProps({ highlight: 'none' })
    expect(wrapper.findAll('.is-dimmed')).toHaveLength(0)
  })

  it('moves focus along edges with the arrow keys', async () => {
    const wrapper = mount(DouNodeGraph, { props: { nodes, edges }, attachTo: document.body })
    const tabbable = wrapper.findAll('[tabindex="0"]')
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]!.text()).toContain('需求')

    await tabbable[0]!.trigger('keydown', { key: 'ArrowRight' })
    const focused = document.activeElement as HTMLElement
    expect(['设计', '开发']).toContain(focused.textContent!.trim())
    await wrapper.vm.$nextTick()
    expect(focused.getAttribute('tabindex')).toBe('0')

    await find(wrapper, '设计').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:selected')!.at(-1)).toEqual(['b'])
    wrapper.unmount()
  })

  it('flows top to bottom with the arrow keys turned', async () => {
    const wrapper = mount(DouNodeGraph, {
      props: { nodes, edges, direction: 'vertical' },
      attachTo: document.body,
    })
    expect(wrapper.classes()).toContain('is-vertical')
    const top = (label: string) =>
      parseFloat((find(wrapper, label).element as HTMLElement).style.top)
    expect(top('设计')).toBeGreaterThan(top('需求'))
    expect(top('设计')).toBe(top('开发'))

    await find(wrapper, '需求').trigger('keydown', { key: 'ArrowDown' })
    const focused = document.activeElement as HTMLElement
    expect(['设计', '开发']).toContain(focused.textContent!.trim())
    await (
      focused.textContent!.includes('设计') ? find(wrapper, '设计') : find(wrapper, '开发')
    ).trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement!.textContent).toContain('需求')
    wrapper.unmount()
  })

  it('renders the starting zoom on the server and keeps it after mounting', async () => {
    const html = await renderToString(
      createSSRApp({ render: () => h(DouNodeGraph, { nodes, edges, zoom: 0.5 }) }),
    )
    expect(html).toContain('scale(0.5)')

    const wrapper = mount(DouNodeGraph, { props: { nodes, edges, zoom: 0.5 } })
    await wrapper.vm.$nextTick()
    const canvas = wrapper.find('.dou-node-graph__canvas').element as HTMLElement
    expect(canvas.style.transform).toContain('scale(0.5)')
    await wrapper.setProps({ zoom: 0.75 })
    expect(canvas.style.transform).toContain('scale(0.75)')
    await wrapper.setProps({ nodes: [...nodes, { id: 'f', label: '新节点' }] })
    expect(canvas.style.transform).toContain('scale(0.75)')
  })

  it('fills the slots', () => {
    const wrapper = mount(DouNodeGraph, {
      props: { nodes, edges },
      slots: {
        label: ({ node }: { node: GraphNode }) => `#${node.label}`,
        corner: ({ node }: { node: GraphNode }) => h('button', { class: 'ai' }, node.id),
      },
    })
    expect(find(wrapper, '#需求').exists()).toBe(true)
    expect(wrapper.findAll('.dou-node-graph__corner .ai')).toHaveLength(5)
  })

  it('does not select a node when its corner is pressed', async () => {
    const wrapper = mount(DouNodeGraph, {
      props: { nodes, edges },
      slots: { corner: () => h('button', { class: 'ai' }) },
    })
    await wrapper.find('.ai').trigger('click')
    expect(wrapper.emitted('update:selected')).toBeUndefined()
  })

  it('zooms with the toolbar buttons only when zoomable', async () => {
    const wrapper = mount(DouNodeGraph, { props: { nodes, edges } })
    expect(wrapper.find('.dou-node-graph__toolbar').exists()).toBe(false)
    await wrapper.setProps({ zoomable: true })
    const tools = wrapper.findAll('.dou-node-graph__tool')
    expect(tools.map((t) => t.attributes('aria-label'))).toEqual([
      '缩小',
      '缩放 100%',
      '放大',
      '适应画布',
    ])
    await tools[2]!.trigger('click')
    expect(wrapper.emitted('update:zoom')!.at(-1)).toEqual([1.25])
    await wrapper.setProps({ zoom: 2, maxZoom: 2 })
    expect(wrapper.findAll('.dou-node-graph__tool')[2]!.attributes('disabled')).toBeDefined()
  })

  it('ignores an edge that closes a cycle', () => {
    const wrapper = mount(DouNodeGraph, {
      props: { nodes, edges: [...edges, { from: 'd', to: 'a' }] },
    })
    expect(wrapper.findAll('.dou-node-graph__edge')).toHaveLength(4)
  })
})

describe('DouNodeGraphLegend', () => {
  it('lists what the nodes use', () => {
    const wrapper = mount(DouNodeGraphLegend, { props: { nodes } })
    expect(wrapper.findAll('li').map((li) => li.text())).toEqual([
      '节点',
      '里程碑',
      '未开始',
      '进行中',
      '已完成',
      '含未完成子任务',
      '进度',
    ])
  })

  it('lists everything without nodes', () => {
    const wrapper = mount(DouNodeGraphLegend)
    expect(wrapper.findAll('li')).toHaveLength(9)
    expect(wrapper.find('.dou-node-graph-legend__title').text()).toBe('图例')
  })
})
