import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DouAutocomplete,
  DouCascader,
  DouCommand,
  DouListbox,
  DouSelect,
  DouTreeSelect,
} from '../index'

afterEach(() => {
  document.body.innerHTML = ''
})

const options = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ value: i, label: `上海 ${i}` }))
const optionEls = () => document.querySelectorAll('[role="option"]')
const settle = async () => {
  for (let i = 0; i < 4; i++) await nextTick()
}

describe('long lists render only what is in view', () => {
  it('Select turns virtual past 100 options, unless told not to', async () => {
    for (const [count, virtual, all] of [
      [100, undefined, true],
      [101, undefined, false],
      [500, false, true],
    ] as const) {
      const wrapper = mount(DouSelect, {
        props: { options: options(count), virtual, teleport: false },
        attachTo: document.body,
      })
      await wrapper.get('.dou-select').trigger('mousedown')
      await settle()
      expect(optionEls().length === count).toBe(all)
      wrapper.unmount()
    }
  })

  it('Autocomplete turns virtual past 100 suggestions', async () => {
    const wrapper = mount(DouAutocomplete, {
      props: { options: options(300).map((o) => ({ value: o.label })), teleport: false },
      attachTo: document.body,
    })
    await wrapper.get('input').trigger('focus')
    await settle()
    expect(optionEls().length).toBeGreaterThan(0)
    expect(optionEls().length).toBeLessThan(50)
    expect(optionEls()[0]!.getAttribute('aria-setsize')).toBe('300')
  })

  it('Cascader renders a long column in part', async () => {
    const wrapper = mount(DouCascader, {
      props: { options: options(300), teleport: false },
      attachTo: document.body,
    })
    await wrapper.get('.dou-cascader').trigger('mousedown')
    await settle()
    expect(optionEls().length).toBeLessThan(50)
    expect(optionEls()[0]!.getAttribute('aria-posinset')).toBe('1')
  })

  it('TreeSelect renders a long tree in part', async () => {
    const data = options(300).map((o) => ({ key: o.value, label: o.label }))
    const wrapper = mount(DouTreeSelect, {
      props: { data, teleport: false },
      attachTo: document.body,
    })
    await wrapper.get('.dou-tree-select').trigger('mousedown')
    await settle()
    expect(document.querySelectorAll('[role="treeitem"]').length).toBeLessThan(50)
  })

  it('TreeSelect keeps a short tree whole', async () => {
    const data = options(20).map((o) => ({ key: o.value, label: o.label }))
    const wrapper = mount(DouTreeSelect, {
      props: { data, teleport: false },
      attachTo: document.body,
    })
    await wrapper.get('.dou-tree-select').trigger('mousedown')
    await settle()
    expect(document.querySelectorAll('[role="treeitem"]').length).toBe(20)
    expect(document.querySelector('.dou-virtual-list')).toBeNull()
  })

  it('Listbox turns virtual with a maxHeight, per group', async () => {
    const groups = [
      { label: '一', options: options(150) },
      { label: '二', options: options(150).map((o) => ({ ...o, value: o.value + 1000 })) },
    ]
    const capped = mount(DouListbox, { props: { options: groups, maxHeight: 300 } })
    await settle()
    expect(capped.findAll('[role="option"]').length).toBeLessThan(50)
    expect(capped.find('[role="option"]').attributes('aria-setsize')).toBe('150')
    const open = mount(DouListbox, { props: { options: groups } })
    expect(open.findAll('[role="option"]').length).toBe(300)
  })

  it('Command turns virtual past 100 items', async () => {
    const items = options(300)
    const wrapper = mount(DouCommand, { props: { items } })
    await settle()
    expect(wrapper.findAll('[role="option"]').length).toBeLessThan(50)
    const full = mount(DouCommand, { props: { items, virtual: false } })
    expect(full.findAll('[role="option"]').length).toBe(300)
  })
})

describe('a missing v-model', () => {
  it('is not read as false', () => {
    const select = mount(DouSelect, { props: { options: options(3), placeholder: '请选择' } })
    expect(select.text()).toContain('请选择')
    expect(select.text()).not.toContain('false')
  })
})
