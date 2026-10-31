import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouDashboard, DouGridLayout, defineDashboardWidget, useDashboardWidget } from '..'
import type { DashboardDocument, DashboardExpose } from '..'

const Stat = defineComponent({
  setup() {
    const { props, setProps } = useDashboardWidget<{ value: number }>()
    return () =>
      h('button', { class: 'stat', onClick: () => setProps({ value: props.value.value + 1 }) }, [
        String(props.value.value),
      ])
  },
})

const widgets = [
  defineDashboardWidget({
    type: 'stat',
    label: '统计数字',
    size: { w: 3, h: 2 },
    defaultProps: { value: 0 },
    component: Stat,
  }),
]

const start = (): DashboardDocument => ({
  version: 1,
  widgets: [
    {
      id: 'a',
      type: 'stat',
      title: '订单',
      props: { value: 1 },
      place: { lg: { x: 0, y: 0, w: 3, h: 2 } },
    },
    { id: 'b', type: 'stat', props: { value: 2 }, place: { lg: { x: 3, y: 0, w: 3, h: 2 } } },
  ],
})

function setup(doc = start(), props: Record<string, unknown> = {}) {
  const model = ref(doc)
  const onChange = vi.fn<(...args: any[]) => void>()
  const wrapper = mount(DouDashboard, {
    attachTo: document.body,
    props: {
      modelValue: model.value,
      'onUpdate:modelValue': (next: DashboardDocument) => {
        model.value = next
        void wrapper.setProps({ modelValue: next })
      },
      onChange,
      widgets,
      editable: true,
      createId: (type: string) => `${type}-${model.value.widgets.length + 1}`,
      ...props,
    },
  })
  const api = wrapper.vm as unknown as DashboardExpose
  return { wrapper, model, api, onChange }
}

const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
  el.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }),
  )

const flush = () => new Promise((resolve) => setTimeout(resolve))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DouDashboard', () => {
  it('draws each widget with its title, or its type’s label', () => {
    const { wrapper } = setup({
      version: 1,
      widgets: [...start().widgets, { id: 'x', type: 'pie', place: {} }],
    })
    const titles = wrapper.findAll('.dou-dashboard__title').map((el) => el.text())
    expect(titles).toEqual(['订单', '统计数字', 'pie'])
    expect(wrapper.findAll('.stat').map((el) => el.text())).toEqual(['1', '2'])
    expect(wrapper.find('.dou-dashboard__notice').text()).toContain('pie')
  })

  it('lets a widget change its own props, as one undo step', async () => {
    const { wrapper, model, api } = setup()
    await wrapper.find('.stat').trigger('click')
    expect(model.value.widgets[0]!.props).toEqual({ value: 2 })
    expect(wrapper.find('.stat').text()).toBe('2')
    expect(api.canUndo).toBe(true)
    api.undo()
    await nextTick()
    expect(model.value.widgets[0]!.props).toEqual({ value: 1 })
    expect(api.canRedo).toBe(true)
  })

  it('adds a widget in the first free spot, with the default props', async () => {
    const { model, api, onChange } = setup()
    const id = api.addWidget('stat')
    await nextTick()
    expect(id).toBe('stat-3')
    expect(model.value.widgets[2]).toEqual({
      id: 'stat-3',
      type: 'stat',
      props: { value: 0 },
      place: { lg: { x: 6, y: 0, w: 3, h: 2 } },
    })
    expect(onChange.mock.calls[0]![0]).toMatchObject({ meta: { origin: 'api' } })
    expect(api.addWidget('pie')).toBeUndefined()
  })

  it('pushes others away when adding at a place', async () => {
    const { model, api } = setup()
    api.addWidget('stat', { at: { x: 0, y: 0 } })
    await nextTick()
    const places = Object.fromEntries(model.value.widgets.map((w) => [w.id, w.place.lg]))
    expect(places['stat-3']).toEqual({ x: 0, y: 0, w: 3, h: 2 })
    expect(places.a!.y).toBeGreaterThanOrEqual(2)
  })

  it('removes the focused widget with Delete, and brings it back with Mod+Z', async () => {
    const { wrapper, model } = setup()
    const a = wrapper.get('[data-grid-id="a"]').element as HTMLElement
    a.focus()
    key(a, 'Delete')
    await nextTick()
    expect(model.value.widgets.map((w) => w.id)).toEqual(['b'])
    await nextTick()
    expect((document.activeElement as HTMLElement).dataset.gridId).toBe('b')
    key(document.activeElement!, 'z', { ctrlKey: true })
    await nextTick()
    expect(model.value.widgets.map((w) => w.id)).toEqual(['a', 'b'])
    key(document.activeElement!, 'z', { ctrlKey: true, shiftKey: true })
    await nextTick()
    expect(model.value.widgets.map((w) => w.id)).toEqual(['b'])
  })

  it('duplicates the focused widget beside it with Mod+D', async () => {
    const { wrapper, model } = setup()
    const a = wrapper.get('[data-grid-id="a"]').element as HTMLElement
    a.focus()
    key(a, 'd', { ctrlKey: true })
    await nextTick()
    const copy = model.value.widgets[1]!
    expect(copy).toMatchObject({ id: 'stat-3', title: '订单', props: { value: 1 } })
    expect(copy.place).toEqual({ lg: { x: 3, y: 0, w: 3, h: 2 } })
    // b made way
    expect(model.value.widgets[2]!.place.lg!.y).toBe(2)
  })

  it('does nothing on keys while not editable', async () => {
    const { wrapper, model } = setup(start(), { editable: false })
    const a = wrapper.get('[data-grid-id="a"]').element
    key(a, 'Delete')
    await nextTick()
    expect(model.value.widgets).toHaveLength(2)
    expect(wrapper.find('.dou-dashboard__header button[aria-label="全屏查看"]').exists()).toBe(true)
  })

  it('gathers a move on the grid into one change of places', async () => {
    const { wrapper, model, api } = setup()
    const grid = wrapper.findComponent(DouGridLayout)
    grid.vm.$emit('update:modelValue', [
      { id: 'a', x: 3, y: 0, w: 3, h: 2 },
      { id: 'b', x: 0, y: 0, w: 3, h: 2 },
    ])
    grid.vm.$emit('update:layouts', { sm: [{ id: 'a', x: 0, y: 2, w: 1, h: 2 }] })
    await flush()
    expect(model.value.widgets[0]!.place).toEqual({
      lg: { x: 3, y: 0, w: 3, h: 2 },
      sm: { x: 0, y: 2, w: 1, h: 2 },
    })
    expect(model.value.widgets[1]!.place).toEqual({ lg: { x: 0, y: 0, w: 3, h: 2 } })
    api.undo()
    await nextTick()
    expect(model.value).toEqual(start())
  })

  it('adds a widget dropped in from outside', async () => {
    const { wrapper, model } = setup()
    const grid = wrapper.findComponent(DouGridLayout)
    grid.vm.$emit('update:modelValue', [
      ...start().widgets.map((w) => ({ id: w.id, ...w.place.lg! })),
      { id: 'new', x: 6, y: 0, w: 3, h: 2 },
    ])
    grid.vm.$emit('drop', { item: { id: 'new', x: 6, y: 0, w: 3, h: 2 }, data: { type: 'stat' } })
    await flush()
    expect(model.value.widgets[2]).toEqual({
      id: 'new',
      type: 'stat',
      props: { value: 0 },
      place: { lg: { x: 6, y: 0, w: 3, h: 2 } },
    })
  })

  it('copies and pastes a widget through the clipboard', async () => {
    const { wrapper, model } = setup()
    const a = wrapper.get('[data-grid-id="a"]').element as HTMLElement
    const store = new Map<string, string>()
    const clipboardData = {
      setData: (type: string, value: string) => store.set(type, value),
      getData: (type: string) => store.get(type) ?? '',
    }
    const clip = (type: string) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'clipboardData', { value: clipboardData })
      a.dispatchEvent(event)
      return event
    }
    expect(clip('copy').defaultPrevented).toBe(true)
    expect(JSON.parse(store.get('text/plain')!).widget.id).toBe('a')
    clip('paste')
    await nextTick()
    expect(model.value.widgets.map((w) => w.id)).toEqual(['a', 'stat-3', 'b'])
  })

  it('forgets the history when the app puts in another document', async () => {
    const { wrapper, api } = setup()
    await wrapper.find('.stat').trigger('click')
    expect(api.canUndo).toBe(true)
    await wrapper.setProps({ modelValue: start() })
    expect(api.canUndo).toBe(false)
  })

  it('shows the empty notice while editing a dashboard without widgets', () => {
    const { wrapper } = setup({ version: 1, widgets: [] })
    expect(wrapper.find('.dou-dashboard__empty').text()).toContain('还没有格子')
  })
})
