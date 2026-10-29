import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { Component } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouSortable, DouSortableHandle } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const fruits = () => [
  { id: 'a', name: '苹果' },
  { id: 'b', name: '香蕉' },
  { id: 'c', name: '橙子' },
]

function mountList(props: Record<string, unknown> = {}) {
  const wrapper = mount(DouSortable, {
    props: {
      modelValue: fruits(),
      animation: false,
      'onUpdate:modelValue': (value: unknown[]) => wrapper.setProps({ modelValue: value }),
      ...props,
    },
    slots: {
      default: ({ item }: { item: { name: string } }) => [
        props.handle ? h(DouSortableHandle) : null,
        h('span', item.name),
      ],
    },
    attachTo: document.body,
  })
  return wrapper
}
const names = (wrapper: ReturnType<typeof mountList>) =>
  wrapper.findAll('.dou-sortable__item').map((item) => item.text())

const pointer = (type: string, x: number, y: number, extra: PointerEventInit = {}) =>
  new PointerEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, ...extra })

describe('DouSortable', () => {
  it('renders the items with their keys, focusable and described', () => {
    const wrapper = mountList()
    const items = wrapper.findAll('.dou-sortable__item')
    expect(names(wrapper)).toEqual(['苹果', '香蕉', '橙子'])
    expect(items[0]!.attributes('data-dou-sortable-key')).toBe('a')
    expect(items[0]!.attributes('tabindex')).toBe('0')
    expect(items[0]!.attributes('aria-roledescription')).toBe('可排序项')
    expect(items[0]!.attributes('aria-description')).toContain('空格键')
  })

  it('moves an item with the keyboard and announces it', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
    const wrapper = mountList({ itemLabel: (item: { name: string }) => item.name })
    const first = () => wrapper.find('[data-dou-sortable-key="a"]')
    await first().trigger('keydown', { key: ' ' })
    expect(first().classes()).toContain('is-lifted')
    expect(document.querySelector('.dou-sortable-live')!.textContent).toBe(
      '已拿起苹果，当前位置 1，共 3 项',
    )
    await first().trigger('keydown', { key: 'ArrowDown' })
    expect(names(wrapper)).toEqual(['香蕉', '苹果', '橙子'])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await first().trigger('keydown', { key: 'End' })
    await first().trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toEqual([
      fruits()[1],
      fruits()[2],
      fruits()[0],
    ])
    expect(wrapper.emitted('sort')).toEqual([[{ item: fruits()[0], oldIndex: 0, newIndex: 2 }]])
    expect(document.querySelector('.dou-sortable-live')!.textContent).toBe(
      '已放下苹果，位置 3，共 3 项',
    )
  })

  it('puts the item back on Escape', async () => {
    const wrapper = mountList()
    const item = () => wrapper.find('[data-dou-sortable-key="b"]')
    await item().trigger('keydown', { key: 'Enter' })
    await item().trigger('keydown', { key: 'ArrowUp' })
    expect(names(wrapper)).toEqual(['香蕉', '苹果', '橙子'])
    await item().trigger('keydown', { key: 'Escape' })
    expect(names(wrapper)).toEqual(['苹果', '香蕉', '橙子'])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('drags with the pointer and drops into the place under it', async () => {
    const wrapper = mountList()
    const el = (key: string) =>
      wrapper.find(`[data-dou-sortable-key="${key}"]`).element as HTMLElement
    const under = vi.fn<() => Element>(() => el('c'))
    document.elementFromPoint = under

    el('a').dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 10, 80))
    await nextTick()
    expect(document.querySelector('.dou-sortable-ghost')).not.toBeNull()
    expect(names(wrapper)).toEqual(['香蕉', '橙子', '苹果'])
    expect(el('a').classList).toContain('is-dragging')

    window.dispatchEvent(pointer('pointerup', 10, 80))
    await flushPromises()
    expect(document.querySelector('.dou-sortable-ghost')).toBeNull()
    expect(wrapper.emitted('sort')).toEqual([[{ item: fruits()[0], oldIndex: 0, newIndex: 2 }]])
    expect(names(wrapper)).toEqual(['香蕉', '橙子', '苹果'])
  })

  it('only drags from the handle when `handle` is set', async () => {
    const wrapper = mountList({ handle: true })
    const item = wrapper.find('[data-dou-sortable-key="a"]').element as HTMLElement
    document.elementFromPoint = () => wrapper.find('[data-dou-sortable-key="b"]').element
    expect(item.getAttribute('tabindex')).toBeNull()

    item.querySelector('span')!.dispatchEvent(pointer('pointerdown', 0, 0))
    window.dispatchEvent(pointer('pointermove', 0, 40))
    window.dispatchEvent(pointer('pointerup', 0, 40))
    await nextTick()
    expect(wrapper.emitted('sort')).toBeUndefined()

    const handle = item.querySelector<HTMLElement>('.dou-sortable__handle')!
    expect(handle.getAttribute('aria-label')).toBe('拖动排序')
    handle.dispatchEvent(pointer('pointerdown', 0, 0))
    window.dispatchEvent(pointer('pointermove', 0, 40))
    window.dispatchEvent(pointer('pointerup', 0, 40))
    await nextTick()
    expect(wrapper.emitted('sort')).toHaveLength(1)
  })

  it('passes items between lists of the same group', async () => {
    const todo = ref(fruits())
    const done = ref<{ id: string; name: string }[]>([])
    const Board = defineComponent({
      setup: () => () =>
        h('div', [
          h(
            DouSortable as Component,
            {
              class: 'todo',
              group: 'board',
              animation: false,
              modelValue: todo.value,
              'onUpdate:modelValue': (value: typeof todo.value) => (todo.value = value),
            },
            { default: ({ item }: { item: { name: string } }) => item.name },
          ),
          h(
            DouSortable as Component,
            {
              class: 'done',
              group: 'board',
              animation: false,
              modelValue: done.value,
              'onUpdate:modelValue': (value: typeof done.value) => (done.value = value),
            },
            { default: ({ item }: { item: { name: string } }) => item.name },
          ),
        ]),
    })
    const wrapper = mount(Board, { attachTo: document.body })
    const doneList = wrapper.find('.done').element
    document.elementFromPoint = () => doneList

    const item = wrapper.find('.todo [data-dou-sortable-key="b"]').element
    item.dispatchEvent(pointer('pointerdown', 0, 0))
    window.dispatchEvent(pointer('pointermove', 200, 0))
    await nextTick()
    expect(wrapper.findAll('.done .dou-sortable__item').map((i) => i.text())).toEqual(['香蕉'])

    window.dispatchEvent(pointer('pointerup', 200, 0))
    await flushPromises()
    expect(todo.value.map((i) => i.id)).toEqual(['a', 'c'])
    expect(done.value.map((i) => i.id)).toEqual(['b'])
  })
})
