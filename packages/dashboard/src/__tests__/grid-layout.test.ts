import { mount } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { DouGridLayout, DouGridLayoutHandle } from '..'
import type { GridItem, GridLayouts } from '..'

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
    await wrapper.setProps({ onChange, onDragStart: onStart })
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
    // the outcome is read out, as it is for the keyboard
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(wrapper.get('.dou-grid-layout__live').text()).toBe(
      '已放下 a，第 7 列第 1 行，宽 6 列，高 2 行',
    )
  })

  it('cancels a drag with Escape', async () => {
    const { wrapper, items } = setup()
    const onEnd = vi.fn<(...args: any[]) => void>()
    await wrapper.setProps({ onDragEnd: onEnd })
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

  it('only starts a move from a DouGridLayoutHandle when handle is on', async () => {
    const items = ref(start())
    const onStart = vi.fn<(...args: any[]) => void>()
    const wrapper = mount(DouGridLayout, {
      attachTo: document.body,
      props: { modelValue: items.value, editable: true, handle: true, onDragStart: onStart },
      slots: {
        item: ({ item }: { item: GridItem }) =>
          h('div', { class: 'card' }, [h(DouGridLayoutHandle, { class: 'title' }, () => item.id)]),
      },
    })
    wrapper.element.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 944, bottom: 400, width: 944, height: 400, x: 0, y: 0 }) as DOMRect
    expect(wrapper.classes()).toContain('has-handle')
    pointer('pointerdown', wrapper.get('[data-grid-id="a"] .card').element, 10, 10)
    pointer('pointermove', window, 400, 10)
    pointer('pointerup', window, 400, 10)
    expect(onStart).not.toHaveBeenCalled()
    pointer('pointerdown', wrapper.get('[data-grid-id="a"] .title').element, 10, 10)
    pointer('pointermove', window, 400, 10)
    expect(onStart).toHaveBeenCalledTimes(1)
    pointer('pointerup', window, 400, 10)
  })

  it('skips presses on data-dou-nodrag parts', async () => {
    const onStart = vi.fn<(...args: any[]) => void>()
    const wrapper = mount(DouGridLayout, {
      attachTo: document.body,
      props: { modelValue: start(), editable: true, onDragStart: onStart },
      slots: { item: () => h('div', [h('span', { class: 'out', 'data-dou-nodrag': '' }, 'x')]) },
    })
    pointer('pointerdown', wrapper.get('[data-grid-id="a"] .out').element, 10, 10)
    pointer('pointermove', window, 400, 10)
    pointer('pointerup', window, 400, 10)
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

  it('adds an item dragged in from outside', async () => {
    const { wrapper, items } = setup()
    const onDrop = vi.fn<(...args: any[]) => void>()
    await wrapper.setProps({ onDrop })
    const source = document.createElement('button')
    document.body.append(source)
    const down = new PointerEvent('pointerdown', {
      clientX: 2000,
      clientY: 2000,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    })
    ;(wrapper.vm as any).startDrop(down, { id: 'new', w: 4, h: 2 }, { kind: 'note' })
    pointer('pointermove', window, 1990, 1990)
    // outside the grid: nothing to show
    await nextTick()
    expect(wrapper.find('.dou-grid-layout__placeholder').exists()).toBe(false)
    // the middle of a 4 × 2 item over column 8, row 0
    pointer('pointermove', window, 8 * 80 + 152, 88)
    await nextTick()
    expect(wrapper.find('.dou-grid-layout__placeholder').exists()).toBe(true)
    pointer('pointerup', window, 8 * 80 + 152, 88)
    await nextTick()
    expect(items.value.find((item) => item.id === 'new')).toMatchObject({ x: 8, y: 0, w: 4, h: 2 })
    expect(onDrop.mock.calls[0]![0]).toMatchObject({
      item: { id: 'new', x: 8, y: 0 },
      data: { kind: 'note' },
      breakpoint: 'lg',
    })
  })
})

function place(wrapper: ReturnType<typeof setup>['wrapper'], id: string) {
  const style = (itemEl(wrapper, id).element as HTMLElement).style
  return ['x', 'y', 'w', 'h'].map((k) => Number(style.getPropertyValue(`--dou-grid-${k}`)))
}

describe('DouGridLayout breakpoints', () => {
  let width = 0
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return (this as HTMLElement).classList.contains('dou-grid-layout') ? width : 0
      },
    })
  })
  afterAll(() => {
    if (original) Object.defineProperty(HTMLElement.prototype, 'clientWidth', original)
  })

  it('works out narrower layouts from the widest', async () => {
    width = 700
    const { wrapper } = setup()
    await nextTick()
    expect((wrapper.vm as any).breakpoint).toBe('md')
    expect(place(wrapper, 'b')).toEqual([3, 0, 3, 2])
    expect(place(wrapper, 'c')).toEqual([0, 2, 6, 2])
  })

  it('stacks on one column, and resizes only the height there', async () => {
    width = 390
    const { wrapper } = setup()
    await nextTick()
    expect(place(wrapper, 'a')).toEqual([0, 0, 1, 2])
    expect(place(wrapper, 'b')).toEqual([0, 2, 1, 2])
    expect(place(wrapper, 'c')).toEqual([0, 4, 1, 2])
    const edges = itemEl(wrapper, 'a')
      .findAll('[data-grid-resize]')
      .map((el) => el.attributes('data-grid-resize'))
    expect(edges).toEqual(['s', 'se'])
  })

  it('keeps changes on a narrower breakpoint in v-model:layouts', async () => {
    width = 390
    const { wrapper, items } = setup()
    const layouts = ref<GridLayouts>({})
    await wrapper.setProps({
      'onUpdate:layouts': (next: GridLayouts) => {
        layouts.value = next
        wrapper.setProps({ layouts: next })
      },
    })
    await nextTick()
    const c = itemEl(wrapper, 'c').element as HTMLElement
    c.focus()
    key(c, 'Enter')
    key(c, 'ArrowUp')
    key(c, 'Enter')
    await nextTick()
    expect(items.value).toEqual(start())
    expect(layouts.value.sm).toEqual([
      { id: 'a', x: 0, y: 0, w: 1, h: 2 },
      { id: 'b', x: 0, y: 4, w: 1, h: 2 },
      { id: 'c', x: 0, y: 2, w: 1, h: 2 },
    ])
    expect(place(wrapper, 'c')).toEqual([0, 2, 1, 2])
  })

  it('reads out the place in the list on one column', async () => {
    width = 390
    const { wrapper } = setup()
    await nextTick()
    const c = itemEl(wrapper, 'c').element as HTMLElement
    // c is 80px wide on 390px; a row is 80px, plus 16px gaps
    pointer('pointerdown', c, 10, 2 * 96 + 10)
    pointer('pointermove', window, 10, 96 + 10)
    pointer('pointermove', window, 10, 10)
    await nextTick()
    pointer('pointerup', window, 10, 10)
    await nextTick()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const n = 1 + ['a', 'b'].filter((id) => place(wrapper, id)[1]! < place(wrapper, 'c')[1]!).length
    expect(n).toBeLessThan(3)
    expect(wrapper.get('.dou-grid-layout__live').text()).toBe(`已放下 c，第 ${n} 个，共 3 个`)
  })

  it('uses one number of columns at every width', async () => {
    width = 390
    const { wrapper } = setup({ columns: 12 })
    await nextTick()
    expect(place(wrapper, 'b')).toEqual([6, 0, 6, 2])
  })
})
