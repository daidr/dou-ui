import { mount } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { containerAt, DouFlowEditor, FlowTree } from '../index'
import type { FlowDocument, FlowEditorExpose, FlowNode, FlowSelection } from '../index'

const node = (id: string, parent?: string): FlowNode => ({ id, x: 0, y: 0, parent })

describe('FlowTree', () => {
  it('links children to parents, at any depth', () => {
    const tree = new FlowTree([node('g'), node('h', 'g'), node('a', 'h'), node('b', 'g')])
    expect(tree.parentOf('a')).toBe('h')
    expect(tree.ancestors('a')).toEqual(['h', 'g'])
    expect(tree.descendants('g')).toEqual(['h', 'a', 'b'])
    expect(tree.depth('a')).toBe(2)
    expect(tree.topmost(['a', 'h', 'b'])).toEqual(['h', 'b'])
  })

  it('ignores missing parents and loops', () => {
    const tree = new FlowTree([node('a', 'nope'), node('b', 'c'), node('c', 'b'), node('d', 'd')])
    expect(tree.parentOf('a')).toBeUndefined()
    expect(tree.parentOf('d')).toBeUndefined()
    // One link of the loop goes, the other stays.
    expect([tree.parentOf('b'), tree.parentOf('c')].filter(Boolean)).toHaveLength(1)
  })

  it('finds the innermost container under a point', () => {
    const outer = { id: 'outer', rect: { x: 0, y: 0, width: 400, height: 400 } }
    const inner = { id: 'inner', rect: { x: 100, y: 100, width: 100, height: 100 } }
    expect(containerAt({ x: 150, y: 150 }, [outer, inner])).toBe('inner')
    expect(containerAt({ x: 50, y: 50 }, [inner, outer])).toBe('outer')
    expect(containerAt({ x: 500, y: 50 }, [outer, inner])).toBeUndefined()
  })
})

// jsdom lays nothing out: an element is as large as its style says, or 200 × 60.
const descriptors = new Map<string, PropertyDescriptor | undefined>()
const sizes: Record<string, (el: HTMLElement) => number> = {
  offsetWidth: (el) => parseFloat(el.style.width) || 200,
  offsetHeight: (el) => parseFloat(el.style.height) || 60,
  clientWidth: () => 1200,
  clientHeight: () => 800,
}
beforeAll(() => {
  for (const [key, size] of Object.entries(sizes)) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key))
    Object.defineProperty(HTMLElement.prototype, key, {
      configurable: true,
      get(this: HTMLElement) {
        return size(this)
      },
    })
  }
})
afterAll(() => {
  for (const [key, descriptor] of descriptors)
    if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor)
})
const mounted: { unmount: () => void }[] = []
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

const sample = (): FlowDocument => ({
  nodes: [
    { id: 'g', type: 'group', x: 0, y: 0, width: 520, height: 200, data: { label: '整理' } },
    {
      id: 'a',
      x: 24,
      y: 56,
      parent: 'g',
      data: { label: '读取笔记', outputs: [{ id: 'out' }] },
    },
    {
      id: 'b',
      x: 288,
      y: 56,
      parent: 'g',
      data: { label: '摘要', inputs: [{ id: 'in' }], outputs: [{ id: 'out' }] },
    },
    { id: 'c', x: 800, y: 56, data: { label: '发布', inputs: [{ id: 'in' }] } },
  ],
  edges: [
    { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } },
    { id: 'bc', source: { node: 'b', port: 'out' }, target: { node: 'c', port: 'in' } },
  ],
})

async function setup(props: Record<string, unknown> = {}) {
  const doc = ref(sample())
  const selection = ref<FlowSelection>({ nodes: [], edges: [] })
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouFlowEditor, {
          modelValue: doc.value,
          'onUpdate:modelValue': (value: FlowDocument) => (doc.value = value),
          selection: selection.value,
          'onUpdate:selection': (value: FlowSelection) => (selection.value = value),
          ...props,
        }),
    ),
    { attachTo: document.body },
  )
  mounted.push(wrapper)
  await ticks()
  const root = wrapper.find('.dou-flow-editor')
  const editor = wrapper.findComponent(DouFlowEditor).vm as unknown as FlowEditorExpose
  return { wrapper, root, editor, doc, selection }
}

const ticks = async () => {
  for (let i = 0; i < 4; i++) await nextTick()
}

const find = (doc: FlowDocument, id: string) => doc.nodes.find((n) => n.id === id)!

const pointer = (type: string, x: number, y: number, init: PointerEventInit = {}) =>
  new PointerEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    button: 0,
    pointerId: 5,
    ...init,
  })

async function drag(
  el: Element,
  from: [number, number],
  to: [number, number],
  init: PointerEventInit = {},
) {
  el.dispatchEvent(pointer('pointerdown', ...from))
  // Pressing selects the node; the parent passes the selection back.
  await ticks()
  const root = document.querySelector('.dou-flow-editor')!
  root.dispatchEvent(pointer('pointermove', (from[0] + to[0]) / 2, (from[1] + to[1]) / 2, init))
  root.dispatchEvent(pointer('pointermove', ...to, init))
  root.dispatchEvent(pointer('pointerup', ...to))
  await ticks()
}

const nodeEl = (id: string) => document.querySelector(`[data-node-id="${id}"]`)!

describe('groups in the editor', () => {
  it('draws containers under the edges, with their title', async () => {
    const { root } = await setup()
    const group = root.find('[data-node-id="g"]')
    expect(group.classes()).toContain('is-container')
    expect(group.text()).toContain('整理')
    // Before the edges in the document's order, so painted under them.
    const order = [...root.element.querySelectorAll('[data-node-id], .dou-flow-editor__edges')]
    expect(order.indexOf(group.element)).toBeLessThan(
      order.findIndex((el) => el.matches('.dou-flow-editor__edges')),
    )
  })

  it('moves what is inside a container with it, as one undo step', async () => {
    const { doc, editor } = await setup()
    // Alt: without snapping to guides.
    await drag(nodeEl('g'), [200, 20], [300, 120], { altKey: true })
    expect(find(doc.value, 'g')).toMatchObject({ x: 100, y: 100 })
    expect(find(doc.value, 'a')).toMatchObject({ x: 124, y: 156, parent: 'g' })
    expect(find(doc.value, 'b')).toMatchObject({ x: 388, y: 156 })
    expect(find(doc.value, 'c')).toMatchObject({ x: 800, y: 56 })
    editor.undo()
    expect(find(doc.value, 'a')).toMatchObject({ x: 24, y: 56 })
  })

  it('moves what is inside with the arrow keys too', async () => {
    const { root, doc, selection } = await setup()
    selection.value = { nodes: ['g'], edges: [] }
    await ticks()
    await root.trigger('keydown', { key: 'ArrowRight' })
    expect(find(doc.value, 'g').x).toBeGreaterThan(0)
    expect(find(doc.value, 'a').x - find(doc.value, 'g').x).toBe(24)
  })

  it('puts a node let go over a container into it, and takes it out when let go outside', async () => {
    const { doc, editor } = await setup()
    await drag(nodeEl('c'), [900, 80], [400, 160])
    expect(find(doc.value, 'c').parent).toBe('g')
    await drag(nodeEl('a'), [100, 80], [100, 500])
    expect(find(doc.value, 'a').parent).toBeUndefined()
    // The move and the change of parent undo together.
    editor.undo()
    expect(find(doc.value, 'a')).toMatchObject({ x: 24, y: 56, parent: 'g' })
  })

  it('folds a container into its title, with edges ending on it', async () => {
    const { root, doc, selection } = await setup()
    selection.value = { nodes: ['a'], edges: [] }
    await root.find('.dou-flow-group-node__toggle').trigger('click')
    await ticks()
    expect(find(doc.value, 'g').data).toMatchObject({ collapsed: true })
    expect(root.find('[data-node-id="g"]').classes()).toContain('is-collapsed')
    expect(root.find('[data-node-id="a"]').exists()).toBe(false)
    // Folded nodes can't stay selected.
    expect(selection.value.nodes).toEqual([])
    // The edge inside is hidden; the one leaving now starts at the container.
    expect(root.find('[data-edge-id="ab"]').exists()).toBe(false)
    expect(root.find('[data-edge-id="bc"]').exists()).toBe(true)
  })

  it('resizes from the corner handle, no smaller than the type allows', async () => {
    const { root, doc, selection, editor } = await setup()
    selection.value = { nodes: ['g'], edges: [] }
    await ticks()
    const handle = root.find('[data-node-id="g"] .dou-flow-editor__resize')
    await drag(handle.element, [520, 200], [600, 263])
    // Kept on the grid.
    expect(find(doc.value, 'g')).toMatchObject({ width: 600, height: 264 })
    await drag(root.find('[data-node-id="g"] .dou-flow-editor__resize').element, [600, 260], [0, 0])
    expect(find(doc.value, 'g')).toMatchObject({ width: 160, height: 96 })
    editor.undo()
    expect(find(doc.value, 'g')).toMatchObject({ width: 600, height: 264 })
  })

  it('groups the selection around it, and ungroups, each as one undo step', async () => {
    const { doc, editor, selection } = await setup()
    editor.ungroupNode('g')
    await ticks()
    expect(doc.value.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c'])
    expect(doc.value.nodes.every((n) => !n.parent)).toBe(true)
    expect(selection.value.nodes).toEqual(['a', 'b'])

    const id = editor.groupNodes(['b', 'c'])!
    await ticks()
    expect(find(doc.value, 'b').parent).toBe(id)
    expect(find(doc.value, 'c').parent).toBe(id)
    expect(find(doc.value, id)).toMatchObject({ type: 'group', x: 264, y: 0, width: 760 })
    expect(selection.value.nodes).toEqual([id])
    editor.undo()
    expect(doc.value.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c'])
    editor.undo()
    expect(find(doc.value, 'a').parent).toBe('g')
  })

  it('groups with Ctrl+G and ungroups with Ctrl+Shift+G', async () => {
    const { root, doc, selection } = await setup()
    selection.value = { nodes: ['g'], edges: [] }
    await ticks()
    await root.trigger('keydown', { key: 'g', ctrlKey: true, shiftKey: true })
    expect(find(doc.value, 'a').parent).toBeUndefined()
    await ticks()
    await root.trigger('keydown', { key: 'g', ctrlKey: true })
    await ticks()
    expect(find(doc.value, 'a').parent).toBe(selection.value.nodes[0])
  })

  it('deletes and copies a container with what is inside it', async () => {
    const { root, doc, selection } = await setup()
    selection.value = { nodes: ['g'], edges: [] }
    await ticks()
    await root.trigger('keydown', { key: 'd', ctrlKey: true })
    await ticks()
    const copies = doc.value.nodes.slice(4)
    expect(copies).toHaveLength(3)
    const group = copies.find((n) => n.type === 'group')!
    expect(copies.filter((n) => n.parent === group.id)).toHaveLength(2)

    selection.value = { nodes: ['g'], edges: [] }
    await ticks()
    await root.trigger('keydown', { key: 'Delete' })
    expect(doc.value.nodes.some((n) => ['g', 'a', 'b'].includes(n.id))).toBe(false)
    expect(doc.value.edges.map((e) => e.id)).not.toContain('bc')
  })

  it('puts a copy into the container it lands in, or none', async () => {
    const { root, doc, selection } = await setup()
    selection.value = { nodes: ['a'], edges: [] }
    await ticks()
    await root.trigger('keydown', { key: 'd', ctrlKey: true })
    await ticks()
    expect(doc.value.nodes.at(-1)!.parent).toBe('g')
    expect(selection.value.nodes).toEqual([doc.value.nodes.at(-1)!.id])
    selection.value = { nodes: ['c'], edges: [] }
    await ticks()
    await root.trigger('keydown', { key: 'd', ctrlKey: true })
    expect(doc.value.nodes.at(-1)!.parent).toBeUndefined()
  })

  it('lays out a container as one block', async () => {
    const { doc, editor } = await setup()
    editor.tidy()
    await ticks()
    const g = find(doc.value, 'g')
    expect(find(doc.value, 'a').x - g.x).toBe(24)
    expect(find(doc.value, 'b').x - g.x).toBe(288)
    expect(find(doc.value, 'c').x).toBeGreaterThanOrEqual(g.x + g.width!)
  })

  it('refuses to group nodes from different groups, and says why', async () => {
    const { root, doc, editor } = await setup()
    expect(editor.groupNodes(['a', 'c'])).toBeNull()
    expect(doc.value.nodes).toHaveLength(4)
    await ticks()
    expect(root.find('.dou-flow-editor__live').text()).toContain('不在同一个分组里')
  })

  it('takes a node out of its group from the keyboard, below the group', async () => {
    const { root, doc, editor, selection } = await setup()
    selection.value = { nodes: ['a'], edges: [] }
    await ticks()
    await root.trigger('keydown', { key: 'g', ctrlKey: true, shiftKey: true })
    await ticks()
    expect(find(doc.value, 'a').parent).toBeUndefined()
    expect(find(doc.value, 'a').y).toBeGreaterThanOrEqual(200)
    expect(find(doc.value, 'g')).toBeDefined()
    expect(root.find('.dou-flow-editor__live').text()).toContain('已移出“整理”')
    editor.undo()
    expect(find(doc.value, 'a')).toMatchObject({ y: 56, parent: 'g' })
  })

  it('moves a node in and out of a group with the arrow keys', async () => {
    const { root, doc, selection } = await setup()
    selection.value = { nodes: ['c'], edges: [] }
    await ticks()
    // c is 280px right of the group; its middle crosses in after a few steps.
    for (let i = 0; i < 20; i++) await root.trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
    expect(find(doc.value, 'c').parent).toBe('g')
    for (let i = 0; i < 20; i++)
      await root.trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    expect(find(doc.value, 'c').parent).toBeUndefined()
  })

  it('resizes a group with Alt and the arrow keys', async () => {
    const { root, doc, selection } = await setup()
    selection.value = { nodes: ['g'], edges: [] }
    await ticks()
    await root.trigger('keydown', { key: 'ArrowRight', altKey: true })
    await root.trigger('keydown', { key: 'ArrowDown', altKey: true, shiftKey: true })
    expect(find(doc.value, 'g')).toMatchObject({ x: 0, y: 0, width: 528, height: 232 })
    await ticks()
    expect(root.find('.dou-flow-editor__live').text()).toBe('整理，宽 528，高 232')
  })

  it('tells screen readers what is a group and where a node is', async () => {
    const { root, doc, editor } = await setup()
    const group = root.find('[data-node-id="g"]')
    expect(group.attributes('aria-roledescription')).toBe('分组')
    expect(group.attributes('aria-description')).toContain('有 2 个节点')
    expect(root.find('[data-node-id="a"]').attributes('aria-description')).toContain('在“整理”里')
    // A new group has no title yet but still a name.
    const id = editor.groupNodes(['c'])!
    await ticks()
    expect(find(doc.value, id).data?.label).toBe('')
    expect(root.find(`[data-node-id="${id}"]`).attributes('aria-label')).toBe('分组')
  })
})
