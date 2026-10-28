import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLayer } from '../use-layer'

function layerComponent(name: string, calls: string[], child?: ReturnType<typeof defineComponent>) {
  return defineComponent({
    name,
    setup() {
      const el = ref<HTMLElement | null>(null)
      useLayer({
        open: true,
        elements: () => [el.value],
        onEscape: () => calls.push(`${name}:escape`),
        onOutside: () => calls.push(`${name}:outside`),
      })
      return () => h('div', [h('button', { ref: el, id: name }, name), child && h(child)])
    },
  })
}

const press = (target: Element) =>
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useLayer', () => {
  it('sends Escape to the topmost layer only', () => {
    const calls: string[] = []
    const Inner = layerComponent('inner', calls)
    const wrapper = mount(layerComponent('outer', calls, Inner), { attachTo: document.body })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(calls).toEqual(['inner:escape'])
    wrapper.unmount()
  })

  it('treats presses inside a child layer as inside its parents', () => {
    const calls: string[] = []
    const Inner = layerComponent('inner', calls)
    const wrapper = mount(layerComponent('outer', calls, Inner), { attachTo: document.body })
    press(document.getElementById('inner')!)
    expect(calls).toEqual([])
    press(document.getElementById('outer')!)
    expect(calls).toEqual(['inner:outside'])
    press(document.body)
    expect(calls).toEqual(['inner:outside', 'inner:outside', 'outer:outside'])
    wrapper.unmount()
  })

  it('stops listening once every layer is closed', () => {
    const calls: string[] = []
    const remove = vi.spyOn(document, 'removeEventListener')
    const wrapper = mount(layerComponent('only', calls), { attachTo: document.body })
    wrapper.unmount()
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(calls).toEqual([])
    remove.mockRestore()
  })
})
