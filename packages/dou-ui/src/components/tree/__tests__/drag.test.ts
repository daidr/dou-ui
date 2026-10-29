import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouTree } from '../../../index'
import type { TreeDropEvent, TreeNodeData, TreeProps } from '../../../index'

const tree = (): TreeNodeData[] => [
  {
    key: 'a',
    label: 'A',
    children: [
      { key: 'a1', label: 'A1' },
      { key: 'a2', label: 'A2' },
    ],
  },
  { key: 'b', label: 'B' },
  { key: 'c', label: 'C', isLeaf: true },
]

const shape = (nodes: TreeNodeData[]): unknown =>
  nodes.map((node) => (node.children ? { [node.key]: shape(node.children) } : node.key))

function make(props: Partial<TreeProps> = {}) {
  const data = ref(tree())
  const drops: TreeDropEvent[] = []
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(DouTree, {
          data: data.value,
          'onUpdate:data': (value: TreeNodeData[]) => (data.value = value),
          onDrop: (event: TreeDropEvent) => drops.push(event),
          defaultExpandAll: true,
          draggable: true,
          ...props,
        }),
    }),
    { attachTo: document.body },
  )
  return { wrapper, data, drops }
}

async function key(wrapper: ReturnType<typeof make>['wrapper'], name: string, alt = false) {
  await wrapper.find('[role="tree"]').trigger('keydown', { key: name, altKey: alt })
  await nextTick()
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Tree dragging', () => {
  it('moves the active node among its siblings with Alt and the arrow keys', async () => {
    const { wrapper, data, drops } = make()
    await wrapper.find('[role="tree"]').trigger('focus')
    await key(wrapper, 'ArrowDown') // a1
    await key(wrapper, 'ArrowDown', true)
    expect(shape(data.value)).toEqual([{ a: ['a2', 'a1'] }, 'b', 'c'])
    expect(drops[0]).toMatchObject({
      node: { key: 'a1' },
      target: { key: 'a2' },
      position: 'after',
    })
    await key(wrapper, 'ArrowUp', true)
    expect(shape(data.value)).toEqual([{ a: ['a1', 'a2'] }, 'b', 'c'])
  })

  it('moves a node out of its parent and into the sibling above', async () => {
    const { wrapper, data } = make()
    await wrapper.find('[role="tree"]').trigger('focus')
    await key(wrapper, 'ArrowDown') // a1
    await key(wrapper, 'ArrowLeft', true)
    expect(shape(data.value)).toEqual([{ a: ['a2'] }, 'a1', 'b', 'c'])
    await key(wrapper, 'ArrowRight', true)
    expect(shape(data.value)).toEqual([{ a: ['a2', 'a1'] }, 'b', 'c'])
  })

  it('respects allowDrag, allowDrop, declared leaves and the filter', async () => {
    const allowDrop = vi.fn<NonNullable<TreeProps['allowDrop']>>(
      (_node, target) => target.key !== 'b',
    )
    const { wrapper, data } = make({ allowDrop })
    await wrapper.find('[role="tree"]').trigger('focus')
    await key(wrapper, 'End') // c
    await key(wrapper, 'ArrowUp', true) // before b: refused
    expect(allowDrop).toHaveBeenCalled()
    expect(shape(data.value)).toEqual([{ a: ['a1', 'a2'] }, 'b', 'c'])

    const leaf = make()
    await leaf.wrapper.find('[role="tree"]').trigger('focus')
    await key(leaf.wrapper, 'End') // c
    await key(leaf.wrapper, 'ArrowUp', true) // before b
    await key(leaf.wrapper, 'ArrowDown') // b
    await key(leaf.wrapper, 'ArrowRight', true) // into c, a declared leaf
    expect(shape(leaf.data.value)).toEqual([{ a: ['a1', 'a2'] }, 'c', 'b'])

    const locked = make({ allowDrag: (node) => node.key !== 'b' })
    await locked.wrapper.find('[role="tree"]').trigger('focus')
    await key(locked.wrapper, 'End')
    await key(locked.wrapper, 'ArrowUp') // b
    await key(locked.wrapper, 'ArrowUp', true)
    expect(locked.drops).toHaveLength(0)

    const filtered = make({ filter: 'A' })
    expect(filtered.wrapper.find('.dou-tree__node.is-draggable').exists()).toBe(false)
  })

  it('drops a dragged row before, after or inside the row under the pointer', async () => {
    const { wrapper, data, drops } = make()
    const rows = () => wrapper.findAll('[role="treeitem"]')
    const rowB = rows().find((row) => row.text() === 'B')!.element as HTMLElement
    rowB.getBoundingClientRect = () => ({
      top: 100,
      bottom: 128,
      height: 28,
      left: 0,
      right: 200,
      width: 200,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    })
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(rowB)

    const rowA1 = rows().find((row) => row.text() === 'A1')!
    await rowA1.trigger('pointerdown', {
      button: 0,
      clientX: 10,
      clientY: 40,
      pointerType: 'mouse',
    })
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 114 }))
    await nextTick()
    expect(rowA1.classes()).toContain('is-dragging')
    expect(rowB.classList).toContain('is-drop-inside')
    expect(document.querySelector('.dou-tree__ghost')?.textContent).toBe('A1')

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 102 }))
    await nextTick()
    expect(rowB.classList).toContain('is-drop-before')
    window.dispatchEvent(new PointerEvent('pointerup'))
    await nextTick()
    expect(shape(data.value)).toEqual([{ a: ['a2'] }, 'a1', 'b', 'c'])
    expect(drops).toHaveLength(1)
    expect(document.querySelector('.dou-tree__ghost')).toBeNull()
  })

  it('puts the row back when Escape is pressed mid-drag', async () => {
    const { wrapper, data } = make()
    const rows = () => wrapper.findAll('[role="treeitem"]')
    const rowB = rows().find((row) => row.text() === 'B')!.element as HTMLElement
    rowB.getBoundingClientRect = () => ({
      top: 100,
      bottom: 128,
      height: 28,
      left: 0,
      right: 200,
      width: 200,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    })
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(rowB)
    await rows()[1]!.trigger('pointerdown', { button: 0, clientX: 10, clientY: 40 })
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 114 }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    window.dispatchEvent(new PointerEvent('pointerup'))
    await nextTick()
    expect(shape(data.value)).toEqual([{ a: ['a1', 'a2'] }, 'b', 'c'])
  })
})
