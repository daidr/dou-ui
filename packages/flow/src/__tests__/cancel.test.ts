import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { defineFlowExtension, DouFlowEditor, FlowTransaction } from '../index'
import type { FlowDocument, FlowEditorExpose } from '../index'

afterEach(() => {
  document.body.innerHTML = ''
})

const sample = (): FlowDocument => ({
  nodes: [
    { id: 'start', x: 0, y: 0, data: { label: '开始' } },
    { id: 'a', x: 288, y: 0, data: { label: '读取笔记' } },
  ],
  edges: [],
})

describe('cancelling a change', () => {
  it('lets an extension cancel a change, and says why', async () => {
    const doc = ref(sample())
    const cancels: FlowTransaction[] = []
    const seen: FlowTransaction[] = []
    const guard = defineFlowExtension({
      name: 'guard',
      transaction: (tr) => {
        if (tr.steps.some((step) => step.type === 'removeNode' && step.id === 'start'))
          tr.cancel('开始节点不能删除')
      },
    })
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouFlowEditor, {
            modelValue: doc.value,
            'onUpdate:modelValue': (value: FlowDocument) => (doc.value = value),
            extensions: [guard],
            onTransactionCancel: (tr: FlowTransaction) => cancels.push(tr),
            onTransaction: (tr: FlowTransaction) => seen.push(tr),
          }),
      ),
      { attachTo: document.body },
    )
    const editor = wrapper.findComponent(DouFlowEditor).vm as unknown as FlowEditorExpose
    const tr = editor.transact((t) => t.removeNode('start'))
    await nextTick()
    expect(tr.cancelled).toBe(true)
    expect(tr.changed).toBe(false)
    expect(doc.value.nodes).toHaveLength(2)
    expect(cancels).toEqual([tr])
    expect(seen).toEqual([])
    expect(editor.canUndo).toBe(false)
    expect(wrapper.find('.dou-flow-editor__notice').text()).toBe('开始节点不能删除')
    await nextTick()
    expect(wrapper.find('.dou-flow-editor__live').text()).toBe('开始节点不能删除')
    editor.transact((t) => t.removeNode('a'))
    expect(doc.value.nodes).toHaveLength(1)
    expect(editor.canUndo).toBe(true)
  })

  it("can't cancel a change kept out of the history, and says so once", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tr = new FlowTransaction(sample())
    tr.setMeta({ history: false }).cancel('不行')
    tr.cancel('还是不行')
    expect(tr.cancelled).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('[@dou-ui/flow]')
    warn.mockRestore()
    expect(new FlowTransaction(sample()).cancel().cancelled).toBe(true)
  })
})
