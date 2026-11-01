import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouFlowEditor, flowKit } from '../index'
import type { FlowDocument, FlowEditorExpose, FlowSelection } from '../index'

const mounted: VueWrapper[] = []
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

const sample = (): FlowDocument => ({
  nodes: [
    { id: 'c', x: 600, y: 0, data: { label: '发布到上海站' } },
    { id: 'a', x: 0, y: 0, data: { label: '读取笔记' } },
    { id: 'b', x: 300, y: 0, data: { label: '审核笔记' } },
    { id: 'd', x: 0, y: 200, data: { label: 'Notes' } },
  ],
  edges: [],
})

function setup() {
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
          extensions: [flowKit()],
        }),
    ),
    { attachTo: document.body },
  )
  mounted.push(wrapper)
  const root = wrapper.find('.dou-flow-editor')
  const editor = wrapper.findComponent(DouFlowEditor).vm as unknown as FlowEditorExpose
  const input = () => wrapper.find<HTMLInputElement>('.dou-find-replace__input')
  return { wrapper, root, editor, selection, input }
}

describe('finding nodes', () => {
  it('lists nodes by name, in reading order', () => {
    const { editor } = setup()
    expect(editor.findNodes('笔记')).toEqual(['a', 'b'])
    expect(editor.findNodes('notes')).toEqual(['d'])
    expect(editor.findNodes('notes', { caseSensitive: true })).toEqual([])
    expect(editor.findNodes('')).toEqual([])
  })

  it('opens with Ctrl+F, selects and centers each match in turn', async () => {
    const { wrapper, root, selection, input } = setup()
    await root.trigger('keydown', { key: 'f', ctrlKey: true })
    expect(input().exists()).toBe(true)
    // only finding: no replace box
    expect(wrapper.findAll('.dou-find-replace__input').length).toBe(1)
    await input().setValue('笔记')
    await nextTick()
    expect(selection.value.nodes).toEqual(['a'])
    expect(wrapper.find('.dou-find-replace__status').text()).toBe('1/2')
    expect(wrapper.findAll('.dou-flow-editor__found').length).toBe(2)
    await input().trigger('keydown', { key: 'Enter' })
    expect(selection.value.nodes).toEqual(['b'])
    await input().trigger('keydown', { key: 'Enter' })
    expect(selection.value.nodes).toEqual(['a'])
    await wrapper.find('.dou-find-replace').trigger('keydown', { key: 'Escape' })
    expect(input().exists()).toBe(false)
    expect(wrapper.findAll('.dou-flow-editor__found').length).toBe(0)
  })

  it('opens from code with a search put in', async () => {
    const { editor, selection, input } = setup()
    editor.openSearch('上海')
    await nextTick()
    await nextTick()
    expect(input().element.value).toBe('上海')
    expect(selection.value.nodes).toEqual(['c'])
    expect(editor.closeSearch()).toBe(true)
    expect(editor.closeSearch()).toBe(false)
  })
})
