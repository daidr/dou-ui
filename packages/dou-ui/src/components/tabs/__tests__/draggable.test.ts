import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouTabPanel, DouTabs } from '../../../index'
import { activeTabDrag, pressTab } from '../tab-drag'
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

  it('ignores modifier keys in pressTab', () => {
    const el = document.createElement('button')
    document.body.append(el)
    const onStart = vi.fn<() => void>()
    for (const init of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
    ]) {
      pressTab(new PointerEvent('pointerdown', { button: 0, clientX: 0, clientY: 0, ...init }), {
        el,
        root: el,
        drag: () => ({
          value: 'a',
          label: 'A',
          group: 'g',
          name: 'n',
          index: 0,
          source: el,
        }),
        onStart,
      })
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 0 }))
      window.dispatchEvent(new PointerEvent('pointerup'))
    }
    expect(onStart).not.toHaveBeenCalled()
    expect(activeTabDrag.value).toBeNull()
    el.remove()
  })

  it('shows the drop marker and accepts a drop on an empty tab list', async () => {
    const moves: TabsMoveEvent[] = []
    const target = mount(
      defineComponent({
        setup: () => () =>
          h(DouTabs, {
            draggable: true,
            group: 'empty-drop',
            name: 'empty',
            onMove: (event: TabsMoveEvent) => moves.push(event),
          }),
      }),
      { attachTo: document.body },
    )
    const sourceEl = document.createElement('button')
    document.body.append(sourceEl)
    const header = target.get('.dou-tabs__header').element as HTMLElement
    const list = target.get('.dou-tabs__list').element as HTMLElement
    Object.defineProperties(list, {
      scrollWidth: { configurable: true, get: () => 200 },
      clientWidth: { configurable: true, get: () => 200 },
    })
    const origElementFromPoint = document.elementFromPoint
    document.elementFromPoint = () => header
    const origRaf = window.requestAnimationFrame
    const origCancelRaf = window.cancelAnimationFrame
    let rafCb: FrameRequestCallback | undefined
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCb = cb
      return 1
    }) as typeof window.requestAnimationFrame
    window.cancelAnimationFrame = () => {}

    try {
      pressTab(new PointerEvent('pointerdown', { button: 0, clientX: 10, clientY: 10 }), {
        el: sourceEl,
        root: sourceEl,
        drag: () => ({
          value: 'doc',
          label: '文档',
          group: 'empty-drop',
          name: undefined,
          index: -1,
          source: sourceEl,
        }),
      })
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 40, clientY: 10 }))
      rafCb?.(16)
      await nextTick()

      expect(target.classes()).toContain('is-drop-target')
      const marker = target.get('.dou-tabs__list .dou-tabs__marker')
      expect(marker.attributes('style')).toContain('translateX(1px)')

      window.dispatchEvent(new PointerEvent('pointerup'))
      await nextTick()
      expect(moves).toEqual([
        { value: 'doc', from: { name: undefined, index: -1 }, to: { name: 'empty', index: 0 } },
      ])
    } finally {
      document.elementFromPoint = origElementFromPoint
      window.requestAnimationFrame = origRaf
      window.cancelAnimationFrame = origCancelRaf
      sourceEl.remove()
      target.unmount()
    }
  })
})
