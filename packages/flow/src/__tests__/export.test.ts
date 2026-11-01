import { mount } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { drawCard, DouFlowEditor, defineNodeType, flowKit, type FlowEditorExpose } from '../index'
import type { FlowDocument, FlowExtension, FlowSelection } from '../index'
import { whiteboardKit } from '../whiteboard'
import { cutText, wrapText } from '../export/context'
import { plainColor } from '../export/color'

// jsdom lays nothing out: give every element a size so nodes get measured.
const descriptors = new Map<string, PropertyDescriptor | undefined>()
const sizes: Record<string, number> = {
  offsetWidth: 200,
  offsetHeight: 60,
  clientWidth: 800,
  clientHeight: 600,
}
beforeAll(() => {
  for (const [key, value] of Object.entries(sizes)) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key))
    Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => value })
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

function setup(
  doc: FlowDocument,
  extensions: (FlowExtension | FlowExtension[])[] = [flowKit()],
  selected: string[] = [],
) {
  const flow = ref(doc)
  const selection = ref<FlowSelection>({ nodes: selected, edges: [] })
  const editor = ref<FlowEditorExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouFlowEditor, {
          ref: editor,
          modelValue: flow.value,
          'onUpdate:modelValue': (value: FlowDocument) => (flow.value = value),
          selection: selection.value,
          'onUpdate:selection': (value: FlowSelection) => (selection.value = value),
          extensions,
        }),
    ),
    { attachTo: document.body },
  )
  mounted.push(wrapper)
  return { editor, flow }
}

const ticks = async () => {
  for (let i = 0; i < 4; i++) await nextTick()
}

// one char per 7px
const measure = (text: string) => [...text].length * 7

describe('text layout', () => {
  it('wraps between words and wide characters, and inside a word only when it must', () => {
    expect(wrapText('周末去上海看展', 35, measure)).toEqual(['周末去上海', '看展'])
    expect(wrapText('see the show', 50, measure)).toEqual(['see the', 'show'])
    expect(wrapText('abcdefghij', 35, measure)).toEqual(['abcde', 'fghij'])
    expect(wrapText('一\n\n二', 100, measure)).toEqual(['一', '', '二'])
  })

  it('cuts one line with an ellipsis', () => {
    expect(cutText('订周六上午的票', 35, measure)).toBe('订周六上…')
    expect(cutText('票', 35, measure)).toBe('票')
    // more lines follow: an ellipsis even when it fits
    expect(cutText('票 ', 35, measure, true)).toBe('票…')
  })

  it('keeps colors SVG readers know as they are', () => {
    expect(plainColor('#112233')).toBe('#112233')
    expect(plainColor('rgba(1, 2, 3, 0.5)')).toBe('rgba(1, 2, 3, 0.5)')
  })
})

const doc = (): FlowDocument => ({
  version: 1,
  nodes: [
    {
      id: 'a',
      x: 0,
      y: 0,
      width: 160,
      height: 60,
      data: { label: '读取 <笔记>', outputs: [{ id: 'out' }] },
    },
    {
      id: 'b',
      x: 300,
      y: 0,
      width: 160,
      height: 60,
      data: { label: '发布', inputs: [{ id: 'in' }] },
    },
    { id: 'c', x: 0, y: 400, width: 160, height: 60, data: { label: '归档' } },
  ],
  edges: [
    {
      id: 'e',
      source: { node: 'a', port: 'out' },
      target: { node: 'b', port: 'in' },
      label: '摘要',
    },
  ],
})

describe('exportSVG', () => {
  it('draws every node and edge, with text escaped', async () => {
    const { editor } = setup(doc())
    await ticks()
    const svg = editor.value!.exportSVG()
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).toContain('读取 &lt;笔记&gt;')
    expect(svg).toContain('归档')
    expect(svg).toContain('摘要')
    expect(svg).toContain('translate(300 0)')
    expect(svg.match(/<path d="M/g)?.length).toBe(1)
    expect(svg).not.toMatch(/oklab|color-mix/)
    // the drawing and 24px around it; the label (21px high, on the line at y 0) reaches up most
    expect(svg).toMatch(/viewBox="-24 -35 /)
  })

  it('draws only the selection, and the edges between its nodes', async () => {
    const { editor } = setup(doc(), [flowKit()], ['a', 'c'])
    await ticks()
    const svg = editor.value!.exportSVG({ range: 'selection', padding: 0, background: false })
    expect(svg).toContain('归档')
    expect(svg).not.toContain('发布')
    expect(svg).not.toContain('摘要')
    expect(svg).toMatch(/viewBox="0 0 200 460"/)
  })

  it('throws when nothing is selected to export', async () => {
    const { editor } = setup(doc())
    await ticks()
    expect(() => editor.value!.exportSVG({ range: 'selection' })).toThrow(/nothing is selected/)
  })

  it('draws what is in view, at the canvas’s size', async () => {
    const { editor } = setup(doc())
    await ticks()
    editor.value!.zoomTo(1)
    const svg = editor.value!.exportSVG({ range: 'view' })
    expect(svg).toMatch(/ width="800" height="600" viewBox="-?\d+ -?\d+ 800 600"/)
  })

  it('cuts text that doesn’t fit with an ellipsis', async () => {
    const { editor } = setup(
      {
        version: 1,
        nodes: [
          {
            id: 's',
            type: 'shape',
            x: 0,
            y: 0,
            width: 100,
            height: 60,
            data: { text: '一段很长很长很长很长很长很长很长很长的文字' },
          },
        ],
        edges: [],
      },
      [flowKit(), whiteboardKit()],
    )
    await ticks()
    expect(editor.value!.exportSVG()).toMatch(/…<\/tspan>/)
  })

  it('draws extensions’ layers over the nodes', async () => {
    const { editor } = setup(doc(), [
      flowKit(),
      {
        name: 'marks',
        drawLayer: (_ctx, draw, nodes) =>
          nodes.map((node) => `<circle data-mark="${draw.escape(node.id)}" r="2"/>`).join(''),
      },
    ])
    await ticks()
    const svg = editor.value!.exportSVG()
    expect(svg).toMatch(/data-mark="a".*data-mark="b".*data-mark="c".*<\/svg>$/)
    expect(svg.indexOf('data-mark')).toBeGreaterThan(svg.lastIndexOf('归档'))
  })

  it('uses a node type’s draw, and a card with the name without one', async () => {
    const stamp = defineNodeType({
      type: 'stamp',
      draw: (node, draw) =>
        drawCard(draw) + `<circle data-stamp="${draw.escape(String(node.data?.label))}" r="4"/>`,
    })
    const plain = defineNodeType({ type: 'plain' })
    const { editor } = setup(
      {
        version: 1,
        nodes: [
          { id: 's', type: 'stamp', x: 0, y: 0, width: 80, height: 80, data: { label: '已审' } },
          { id: 'p', type: 'plain', x: 120, y: 0, width: 80, height: 40, data: { label: '备注' } },
        ],
        edges: [],
      },
      [flowKit(), { name: 'types', nodeTypes: [stamp, plain] }],
    )
    await ticks()
    const svg = editor.value!.exportSVG()
    expect(svg).toContain('data-stamp="已审"')
    expect(svg).toMatch(
      /<g transform="translate\(120 0\)"><rect [^>]*\/><text[^>]*><tspan[^>]*>备注</,
    )
  })

  it('draws a folded group without what is inside', async () => {
    const { editor } = setup({
      version: 1,
      nodes: [
        {
          id: 'g',
          type: 'group',
          x: 0,
          y: 0,
          width: 300,
          height: 200,
          data: { label: '收集', collapsed: true },
        },
        {
          id: 'in',
          parent: 'g',
          x: 20,
          y: 60,
          width: 120,
          height: 40,
          data: { label: '本周日程' },
        },
      ],
      edges: [],
    })
    await ticks()
    const svg = editor.value!.exportSVG()
    expect(svg).toContain('收集')
    expect(svg).not.toContain('本周日程')
    // a picture has nothing to fold: no toggle
    expect(svg).not.toContain('<svg x="12" y="12"')
  })

  it('draws whiteboard nodes: turned, inked and with images', async () => {
    const { editor } = setup(
      {
        version: 1,
        nodes: [
          {
            id: 'r',
            type: 'shape',
            x: 0,
            y: 0,
            width: 100,
            height: 60,
            data: { shape: 'diamond', text: '周六有空？', rotation: 30 },
          },
          {
            id: 'i',
            type: 'ink',
            x: 200,
            y: 0,
            width: 40,
            height: 20,
            data: { box: [20, 10], points: [2, 2, 0.5, 18, 8, 0.5] },
          },
          {
            id: 'p',
            type: 'image',
            x: 300,
            y: 0,
            width: 80,
            height: 60,
            data: { src: 'https://example.com/a.png', alt: '海报' },
          },
        ],
        edges: [],
      },
      [flowKit(), whiteboardKit()],
    )
    await ticks()
    const svg = editor.value!.exportSVG()
    expect(svg).toContain('<g transform="rotate(30 100 30)"><polygon')
    expect(svg).toContain('周六有空？')
    // the stroke, its points fitted to the node's size: no stretched outline
    expect(svg).toMatch(/<path d="M[^"]+" fill="[^"]*"\/>/)
    expect(svg).not.toContain('scale(')
    expect(svg).toContain('<image href="https://example.com/a.png"')
    // the turned box is what the drawing covers
    expect(svg).toMatch(/viewBox="-\d+ -\d+ /)
  })
})
