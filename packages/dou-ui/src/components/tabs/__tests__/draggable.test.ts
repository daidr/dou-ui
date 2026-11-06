import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouTabPanel, DouTabs } from '../../../index'
import type { TabsMoveEvent } from '../tabs'

const make = (props: Record<string, unknown> = {}) => {
  const moves: TabsMoveEvent[] = []
  const pages = ref(['sh', 'bj', 'sz'])
  const wrapper = mount(
    defineComponent({
      setup() {
        const value = ref<string | number | undefined>('sh')
        return () =>
          h(
            DouTabs,
            {
              draggable: true,
              name: 'main',
              ...props,
              modelValue: value.value,
              'onUpdate:modelValue': (v: string | number | undefined) => (value.value = v),
              onMove: (event: TabsMoveEvent) => {
                moves.push(event)
                const next = [...pages.value]
                const [page] = next.splice(event.from.index, 1)
                next.splice(event.to.index, 0, page!)
                pages.value = next
              },
            },
            () =>
              pages.value.map((page) => h(DouTabPanel, { key: page, value: page, label: page })),
          )
      },
    }),
    { attachTo: document.body },
  )
  return { wrapper, moves, pages }
}

const settle = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}

describe('DouTabs draggable', () => {
  it('moves the focused tab with Alt and the arrow keys and keeps the focus on it', async () => {
    const { wrapper, moves } = make()
    await settle()
    const first = wrapper.findAll('[role="tab"]')[0]!
    ;(first.element as HTMLElement).focus()
    await first.trigger('keydown', { key: 'ArrowRight', altKey: true })
    expect(moves).toEqual([
      { value: 'sh', from: { name: 'main', index: 0 }, to: { name: 'main', index: 1 } },
    ])
    await settle()
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((tab) => tab.text())).toEqual(['bj', 'sh', 'sz'])
    expect(document.activeElement).toBe(tabs[1]!.element)
    // still selected: moving is not switching
    expect(tabs[1]!.attributes('aria-selected')).toBe('true')

    await tabs[1]!.trigger('keydown', { key: 'End', altKey: true })
    expect(moves.at(-1)!.to.index).toBe(2)
    await settle()
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual(['bj', 'sz', 'sh'])
    wrapper.unmount()
  })

  it('does nothing past the ends, and without draggable', async () => {
    const { wrapper, moves } = make()
    await settle()
    await wrapper.findAll('[role="tab"]')[0]!.trigger('keydown', { key: 'ArrowLeft', altKey: true })
    expect(moves).toEqual([])
    wrapper.unmount()

    const plain = make({ draggable: false })
    await settle()
    await plain.wrapper
      .findAll('[role="tab"]')[0]!
      .trigger('keydown', { key: 'ArrowRight', altKey: true })
    expect(plain.moves).toEqual([])
    // a plain arrow moves on to the next tab
    expect(plain.wrapper.findAll('[role="tab"]')[1]!.attributes('aria-selected')).toBe('true')
    plain.wrapper.unmount()
  })

  it('declares the move keys', async () => {
    const { wrapper } = make({ closable: true })
    await settle()
    expect(wrapper.find('[role="tab"]').attributes('aria-keyshortcuts')).toBe(
      'Delete Alt+ArrowLeft Alt+ArrowRight Alt+Home Alt+End',
    )
    wrapper.unmount()
  })

  it('follows panels put in a new order', async () => {
    const { wrapper, pages } = make({ draggable: false })
    await settle()
    pages.value = ['sz', 'sh', 'bj']
    await settle()
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual(['sz', 'sh', 'bj'])
    wrapper.unmount()
  })
})
