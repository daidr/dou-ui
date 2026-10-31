import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { DouGridLayout } from '..'
import type { GridItem } from '..'

const start = (): GridItem[] => [
  { id: 'a', x: 0, y: 0, w: 6, h: 2 },
  { id: 'b', x: 6, y: 0, w: 6, h: 2 },
  { id: 'c', x: 0, y: 2, w: 12, h: 2 },
]

function setup(props: Record<string, unknown> = {}) {
  const items = ref(start())
  const wrapper = mount(DouGridLayout, {
    attachTo: document.body,
    props: {
      modelValue: items.value,
      'onUpdate:modelValue': (next: GridItem[]) => {
        items.value = next
        wrapper.setProps({ modelValue: next })
      },
      editable: true,
      ...props,
    },
    slots: { item: ({ item }: { item: GridItem }) => h('div', { class: 'card' }, item.id) },
  })
  // 12 columns of 64px with 16px gaps: 944px wide
  wrapper.element.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 944, bottom: 400, width: 944, height: 400, x: 0, y: 0 }) as DOMRect
  return { wrapper, items }
}

const itemEl = (wrapper: ReturnType<typeof setup>['wrapper'], id: string) =>
  wrapper.get(`[data-grid-id="${id}"]`)

function pointer(type: string, target: Element | Window, x: number, y: number) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
  })
  target.dispatchEvent(event)
}

const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
  el.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }),
  )

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DouGridLayout', () => {
  it('places items by cell through CSS variables', () => {
    const { wrapper } = setup()
    const b = itemEl(wrapper, 'b').element as HTMLElement
    expect(b.style.getPropertyValue('--dou-grid-x')).toBe('6')
    expect(b.style.getPropertyValue('--dou-grid-w')).toBe('6')
    expect((wrapper.element as HTMLElement).style.getPropertyValue('--dou-grid-rows')).toBe('4')
    expect(wrapper.findAll('.card').map((el) => el.text())).toEqual(['a', 'b', 'c'])
  })

  it('settles the layout it is given without changing v-model', () => {
    const onUpdate = vi.fn<(...args: any[]) => void>()
    const wrapper = mount(DouGridLayout, {
      props: {
        modelValue: [{ id: 'a', x: 0, y: 5, w: 4, h: 1 }],
        'onUpdate:modelValue': onUpdate,
      },
    })
    const a = wrapper.get('[data-grid-id="a"]').element as HTMLElement
    expect(a.style.getPropertyValue('--dou-grid-y')).toBe('0')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('is not focusable or draggable when not editable', () => {
    const { wrapper } = setup({ editable: false })
    const a = itemEl(wrapper, 'a')
    expect(a.attributes('tabindex')).toBeUndefined()
    expect(a.find('[data-grid-resize]').exists()).toBe(false)
  })

  it('keeps one item in the tab order', () => {
    const { wrapper } = setup()
    expect(itemEl(wrapper, 'a').attributes('tabindex')).toBe('0')
    expect(itemEl(wrapper, 'b').attributes('tabindex')).toBe('-1')
    expect(itemEl(wrapper, 'a').attributes('aria-roledescription')).toBe('格子')
  })

  it('moves an item with the mouse and updates v-model once, on drop', async () => {
    const { wrapper, items } = setup()
    const onChange = vi.fn<(...args: any[]) => void>()
    const onStart = vi.fn<(...args: any[]) => void>()
    await wrapper.setProps({ onChange, 'onDrag-start': onStart })
    const a = itemEl(wrapper, 'a').element
    pointer('pointerdown', a, 10, 10)
    pointer('pointermove', window, 12, 11)
    expect(onStart).not.toHaveBeenCalled()
    // one column is 80px: 6 columns right lands on b
    pointer('pointermove', window, 10 + 480, 10)
    await nextTick()
    expect(onStart).toHaveBeenCalledWith({ id: 'a', kind: 'move' })
    expect(wrapper.find('.dou-grid-layout__placeholder').exists()).toBe(true)
    expect((a as HTMLElement).style.getPropertyValue('--dou-grid-dx')).toBe('480px')
    expect(items.value[0]!.x).toBe(0)
    pointer('pointerup', window, 10 + 480, 10)
    await nextTick()
    expect(items.value.map((item) => [item.id, item.x, item.y])).toEqual([
      ['a', 6, 0],
      ['b', 0, 0],
      ['c', 0, 2],
    ])
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]![0]).toMatchObject({ id: 'a', reason: 'move' })
    expect(wrapper.find('.dou-grid-layout__placeholder').exists()).toBe(false)
    expect((a as HTMLElement).style.getPropertyValue('--dou-grid-dx')).toBe('')
  })

  it('cancels a drag with Escape', async () => {
    const { wrapper, items } = setup()
    const onEnd = vi.fn<(...args: any[]) => void>()
    await wrapper.setProps({ 'onDrag-end': onEnd })
    const a = itemEl(wrapper, 'a').element
    pointer('pointerdown', a, 10, 10)
    pointer('pointermove', window, 490, 10)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    pointer('pointerup', window, 490, 10)
    await nextTick()
    expect(items.value).toEqual(start())
    expect(onEnd).toHaveBeenCalledWith({ id: 'a', kind: 'move', cancelled: true })
  })

  it('resizes from the corner handle', async () => {
    const { wrapper, items } = setup()
    const handle = itemEl(wrapper, 'a').get('[data-grid-resize="se"]').element
    pointer('pointerdown', handle, 0, 0)
    // a row is 80 + 16: one row down, two columns narrower
    pointer('pointermove', window, -160, 96)
    pointer('pointerup', window, -160, 96)
    await nextTick()
    expect(items.value[0]).toMatchObject({ id: 'a', w: 4, h: 3 })
    expect(items.value[2]).toMatchObject({ id: 'c', y: 3 })
  })

  it('only starts a move from the handle when one is set', async () => {
    const { wrapper } = setup({ handle: '.title' })
    const onStart = vi.fn<(...args: any[]) => void>()
    await wrapper.setProps({ 'onDrag-start': onStart })
    pointer('pointerdown', itemEl(wrapper, 'a').get('.card').element, 10, 10)
    pointer('pointermove', window, 400, 10)
    expect(onStart).not.toHaveBeenCalled()
  })

  it('moves with the keyboard and announces it', async () => {
    const { wrapper, items } = setup()
    const onChange = vi.fn<(...args: any[]) => void>()
    await wrapper.setProps({ onChange })
    const a = itemEl(wrapper, 'a').element as HTMLElement
    a.focus()
    key(a, 'Enter')
    await nextTick()
    expect(a.classList.contains('is-dragging')).toBe(true)
    key(a, 'ArrowDown')
    await nextTick()
    // past c, which is as wide as the grid
    expect(
      (itemEl(wrapper, 'a').element as HTMLElement).style.getPropertyValue('--dou-grid-y'),
    ).toBe('4')
    key(a, 'ArrowRight', { shiftKey: true })
    await nextTick()
    key(a, 'Enter')
    await nextTick()
    expect(items.value.find((item) => item.id === 'a')).toMatchObject({ x: 0, y: 4, w: 7, h: 2 })
    expect(onChange.mock.calls[0]![0]).toMatchObject({ id: 'a', reason: 'keyboard' })
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(wrapper.get('.dou-grid-layout__live').text()).toContain('已放下 a')
  })

  it('puts a picked-up item back on Escape', async () => {
    const { wrapper, items } = setup()
    const a = itemEl(wrapper, 'a').element as HTMLElement
    a.focus()
    key(a, 'Enter')
    key(a, 'ArrowRight')
    key(a, 'Escape')
    await nextTick()
    expect(items.value).toEqual(start())
  })

  it('moves focus between items with the arrow keys', async () => {
    const { wrapper } = setup()
    const a = itemEl(wrapper, 'a').element as HTMLElement
    a.focus()
    key(a, 'ArrowRight')
    expect(document.activeElement).toBe(itemEl(wrapper, 'b').element)
    key(document.activeElement!, 'ArrowDown')
    expect(document.activeElement).toBe(itemEl(wrapper, 'c').element)
    await nextTick()
    expect(itemEl(wrapper, 'c').attributes('tabindex')).toBe('0')
  })

  it('does not move locked items', async () => {
    const items = ref<GridItem[]>([{ id: 'l', x: 0, y: 0, w: 4, h: 2, locked: true }])
    const wrapper = mount(DouGridLayout, {
      attachTo: document.body,
      props: { modelValue: items.value, editable: true },
    })
    const l = wrapper.get('[data-grid-id="l"]')
    expect(l.find('[data-grid-resize]').exists()).toBe(false)
    expect(l.attributes('aria-describedby')).toBeUndefined()
    key(l.element, 'Enter')
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(wrapper.get('.dou-grid-layout__live').text()).toContain('已锁定')
  })
})
