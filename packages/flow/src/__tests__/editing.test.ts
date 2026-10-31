import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { defaultNode, defineFlowExtension, defineNodeType, DouFlowEditor, flowKit } from '../index'
import type { FlowDocument, FlowEditorExpose, FlowExtension, FlowSelection } from '../index'

const note = defineNodeType({
  ...defaultNode,
  type: 'note',
  defaults: () => ({ label: '备注' }),
  palette: { label: '备注', group: '其他' },
})
const summary = defineNodeType({
  ...defaultNode,
  type: 'summary',
  defaults: () => ({
    label: '生成摘要',
    inputs: [
      { id: 'image', dataType: 'image' },
      { id: 'text', dataType: 'text' },
    ],
    outputs: [{ id: 'out', dataType: 'text' }],
  }),
  palette: { label: '生成摘要', group: '处理' },
})

const sample = (): FlowDocument => ({
  nodes: [
    {
      id: 'a',
      x: 0,
      y: 0,
      data: { label: '读取笔记', outputs: [{ id: 'out', dataType: 'text' }] },
    },
    { id: 'b', x: 288, y: 0, data: { label: '发布', inputs: [{ id: 'in' }] } },
  ],
  edges: [],
})

function setup(
  extensions: (FlowExtension | FlowExtension[])[] = [
    flowKit(),
    { name: 'types', nodeTypes: [note, summary] },
  ],
  props: Record<string, unknown> = {},
) {
  const doc = ref(sample())
  const selection = ref<FlowSelection>({ nodes: [], edges: [] })
  const events: string[] = []
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouFlowEditor, {
          modelValue: doc.value,
          'onUpdate:modelValue': (value: FlowDocument) => (doc.value = value),
          selection: selection.value,
          'onUpdate:selection': (value: FlowSelection) => (selection.value = value),
          extensions,
          ...props,
        }),
    ),
    { attachTo: document.body },
  )
  const root = wrapper.find('.dou-flow-editor')
  const editor = wrapper.findComponent(DouFlowEditor).vm as unknown as FlowEditorExpose
  return { wrapper, root, editor, doc, selection, events }
}

const menuItems = () =>
  [...document.body.querySelectorAll('.dou-dropdown__item')].map((el) => el.textContent!.trim())

async function rightClick(el: Element, init: MouseEventInit = {}) {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: 120,
    clientY: 80,
    ...init,
  })
  el.dispatchEvent(event)
  await nextTick()
  await nextTick()
  return event
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('insertNode', () => {
  it('adds a node with its defaults, selected, as one undo step', async () => {
    const { editor, doc, selection, wrapper } = setup()
    const id = editor.insertNode('note', { at: { x: 400, y: 200 } })!
    await nextTick()
    const node = doc.value.nodes.find((n) => n.id === id)!
    expect(node.type).toBe('note')
    expect(node.data).toEqual({ label: '备注' })
    expect(selection.value.nodes).toEqual([id])
    editor.undo()
    await nextTick()
    expect(doc.value.nodes.find((n) => n.id === id)).toBeUndefined()
    wrapper.unmount()
  })

  it('refuses unknown types, and adds nothing while read only', () => {
    expect(setup().editor.insertNode('nope')).toBeNull()
    const { editor, doc } = setup(undefined, { readonly: true })
    expect(editor.insertNode('note')).toBeNull()
    expect(doc.value.nodes).toHaveLength(2)
  })

  it('without a point, goes after the one selected node and connects to it', async () => {
    const { editor, doc, selection } = setup()
    selection.value = { nodes: ['a'], edges: [] }
    await nextTick()
    const first = editor.insertNode('summary')!
    await nextTick()
    expect(doc.value.edges).toEqual([
      expect.objectContaining({
        source: { node: 'a', port: 'out' },
        target: { node: first, port: 'text' },
      }),
    ])
    expect(doc.value.nodes.find((n) => n.id === first)!.x).toBeGreaterThan(0)
    // The new node is selected, so the next one chains on.
    const second = editor.insertNode('summary')!
    await nextTick()
    expect(doc.value.edges[1]).toEqual(
      expect.objectContaining({
        source: { node: first, port: 'out' },
        target: { node: second, port: 'text' },
      }),
    )
  })

  it('exposes the palette types', () => {
    expect(setup().editor.paletteTypes.map((spec) => spec.type)).toEqual(['note', 'summary'])
  })

  it('connects through the first port that can take the edge', async () => {
    const { editor, doc } = setup()
    const id = editor.insertNode('summary', {
      at: { x: 400, y: 0 },
      from: { node: 'a', port: 'out' },
    })!
    await nextTick()
    // `image` comes first but doesn't take text.
    expect(doc.value.edges).toEqual([
      expect.objectContaining({
        source: { node: 'a', port: 'out' },
        target: { node: id, port: 'text' },
      }),
    ])
    editor.undo()
    await nextTick()
    expect(doc.value.nodes).toHaveLength(2)
    expect(doc.value.edges).toHaveLength(0)
  })
})

describe('context menu', () => {
  it('offers the kit items for the canvas, a node and an edge', async () => {
    const { root, selection } = setup()
    await rightClick(root.element)
    expect(menuItems()).toEqual(
      expect.arrayContaining([
        expect.stringContaining('粘贴'),
        expect.stringContaining('适应画布'),
      ]),
    )
    const node = root.find('[data-node-id="a"]')
    await rightClick(node.element)
    expect(selection.value.nodes).toEqual(['a'])
    expect(menuItems().map((t) => t.replace(/Ctrl.*|Delete/, ''))).toEqual([
      '复制',
      '剪切',
      '复制一份',
      '删除',
      '放进分组',
    ])
  })

  it('runs the chosen item', async () => {
    const { root, doc } = setup()
    await rightClick(root.find('[data-node-id="a"]').element)
    const remove = [...document.body.querySelectorAll<HTMLElement>('.dou-dropdown__item')].find(
      (el) => el.textContent!.includes('删除'),
    )!
    remove.click()
    await nextTick()
    expect(doc.value.nodes.map((n) => n.id)).toEqual(['b'])
  })

  it('puts extension items first, with a divider, and the kit can be left out', async () => {
    const extra = defineFlowExtension({
      name: 'extra',
      contextMenu: (_, target) =>
        target.kind === 'canvas' ? [{ key: 'hello', label: '打个招呼', run: () => {} }] : [],
    })
    const { root } = setup([flowKit(), extra])
    await rightClick(root.element)
    const items = [...document.body.querySelectorAll('.dou-dropdown__item, [role=separator]')]
    expect(items[0]!.textContent).toContain('打个招呼')
    expect(items[1]!.getAttribute('role')).toBe('separator')
    document.body.innerHTML = ''

    const bare = setup([flowKit({ menu: false })])
    const event = await rightClick(bare.root.element)
    expect(menuItems()).toEqual([])
    // Nothing to show: the browser keeps its own menu.
    expect(event.defaultPrevented).toBe(false)
  })

  it('stays closed when the event is prevented', async () => {
    const { root } = setup(undefined, {
      onCanvasContextmenu: (_: unknown, event: MouseEvent) => event.preventDefault(),
    })
    await rightClick(root.element)
    expect(menuItems()).toEqual([])
  })
})

describe('toolbar', () => {
  it('floats over the selected nodes, and duplicates them', async () => {
    const { root, selection, doc } = setup()
    expect(root.find('.dou-flow-toolbar').exists()).toBe(false)
    selection.value = { nodes: ['a'], edges: [] }
    await nextTick()
    const buttons = root.findAll('.dou-flow-toolbar button')
    expect(buttons.map((b) => b.attributes('aria-label'))).toEqual(['复制一份', '删除', '更多'])
    await buttons[0]!.trigger('click')
    expect(doc.value.nodes).toHaveLength(3)
  })

  it('is hidden while read only, or without the kit toolbar', async () => {
    for (const [extensions, props] of [
      [undefined, { readonly: true }],
      [[flowKit({ toolbar: false })], {}],
    ] as const) {
      const { root, selection } = setup(extensions as never, props)
      selection.value = { nodes: ['a'], edges: [] }
      await nextTick()
      expect(root.find('.dou-flow-toolbar').exists()).toBe(false)
    }
  })
})

const pointer = (type: string, x: number, y: number) =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    pointerId: 7,
  })

describe('startInsertDrag', () => {
  it('adds a node where it is let go over the canvas, and stops the click after', async () => {
    const { editor, root, doc } = setup()
    const source = document.createElement('button')
    let clicks = 0
    source.addEventListener('click', () => clicks++)
    document.body.append(source)
    document.elementFromPoint = () => root.element
    expect(editor.startInsertDrag('note', pointer('pointerdown', 0, 0))).toBe(true)
    window.dispatchEvent(pointer('pointermove', 200, 120))
    await nextTick()
    expect(document.body.querySelector('.dou-flow-editor__ghost')!.textContent).toContain('备注')
    window.dispatchEvent(pointer('pointerup', 200, 120))
    source.click()
    await nextTick()
    expect(doc.value.nodes.map((n) => n.type)).toEqual([undefined, undefined, 'note'])
    expect(clicks).toBe(0)
    expect(document.body.querySelector('.dou-flow-editor__ghost')).toBeNull()
  })

  it('adds nothing when cancelled with Escape or let go off the canvas', async () => {
    const { editor, doc } = setup()
    document.elementFromPoint = () => document.body
    editor.startInsertDrag('note', pointer('pointerdown', 0, 0))
    window.dispatchEvent(pointer('pointermove', 200, 120))
    window.dispatchEvent(pointer('pointerup', 200, 120))
    editor.startInsertDrag('note', pointer('pointerdown', 0, 0))
    window.dispatchEvent(pointer('pointermove', 200, 120))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    window.dispatchEvent(pointer('pointerup', 200, 120))
    await nextTick()
    expect(doc.value.nodes).toHaveLength(2)
  })

  it('starts nothing for unknown types or while read only', () => {
    expect(setup().editor.startInsertDrag('nope', pointer('pointerdown', 0, 0))).toBe(false)
    const { editor } = setup(undefined, { readonly: true })
    expect(editor.startInsertDrag('note', pointer('pointerdown', 0, 0))).toBe(false)
  })
})
