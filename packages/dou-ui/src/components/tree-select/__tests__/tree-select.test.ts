import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouTreeSelect } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

const data = [
  {
    key: 'eng',
    label: '研发',
    children: [
      { key: 'fe', label: '前端' },
      { key: 'be', label: '后端' },
    ],
  },
  { key: 'design', label: '设计' },
]

function withModel(props: Record<string, unknown> = {}) {
  const wrapper = mount(DouTreeSelect, {
    props: {
      data,
      modelValue: null,
      'onUpdate:modelValue': (value: unknown) => wrapper.setProps({ modelValue: value as never }),
      ...props,
    } as never,
    attachTo: document.body,
  })
  return wrapper
}

const tree = () => document.querySelector<HTMLElement>('[role="tree"]')
const treeItem = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="treeitem"]')].find((el) =>
    el.textContent?.includes(label),
  )!
const key = (target: Element, name: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))

describe('DouTreeSelect', () => {
  it('is a combobox that opens a tree', async () => {
    const wrapper = withModel({ defaultExpandAll: true })
    const box = wrapper.get('[role="combobox"]')
    expect(box.attributes('aria-haspopup')).toBe('tree')
    expect(box.attributes('aria-expanded')).toBe('false')
    await box.trigger('mousedown')
    await nextTick()
    expect(box.attributes('aria-expanded')).toBe('true')
    expect(box.attributes('aria-controls')).toBe(tree()!.id)
  })

  it('chooses a node, shows its label and closes', async () => {
    const wrapper = withModel({ defaultExpandAll: true })
    await wrapper.get('.dou-select').trigger('mousedown')
    await nextTick()
    treeItem('前端').click()
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('fe')
    expect(wrapper.get('.dou-select__value').text()).toBe('前端')
    expect(wrapper.get('[role="combobox"]').attributes('aria-expanded')).toBe('false')
  })

  it('with leafOnly, a branch cannot be chosen', async () => {
    const wrapper = withModel({ leafOnly: true })
    await wrapper.get('.dou-select').trigger('mousedown')
    await nextTick()
    treeItem('研发').click()
    await nextTick()
    expect(wrapper.props('modelValue')).toBeNull()
  })

  it('checks several nodes and shows a fully checked branch as one tag', async () => {
    const wrapper = withModel({ multiple: true, modelValue: ['eng', 'fe', 'be'] })
    expect(wrapper.findAll('.dou-select__tag').map((tag) => tag.text())).toEqual(['研发'])
    // Removing the branch tag unchecks everything under it.
    await wrapper.get('.dou-select__tag button').trigger('click')
    expect(wrapper.props('modelValue')).toEqual([])
  })

  it('removing a child tag also unchecks its branch', async () => {
    const wrapper = withModel({ multiple: true, modelValue: ['fe', 'design'] })
    expect(wrapper.findAll('.dou-select__tag').map((tag) => tag.text())).toEqual(['前端', '设计'])
    await wrapper.findAll('.dou-select__tag button')[0]!.trigger('click')
    expect(wrapper.props('modelValue')).toEqual(['design'])
  })

  it('opens with ArrowDown, moves focus into the tree, and Escape hands it back', async () => {
    const wrapper = withModel()
    const box = wrapper.get('[role="combobox"]').element as HTMLElement
    box.focus()
    key(box, 'ArrowDown')
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(tree())
    key(tree()!, 'Escape')
    await nextTick()
    expect(box.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(box)
  })

  it('filters the tree by what is typed', async () => {
    const wrapper = withModel({ filterable: true })
    await wrapper.get('input').setValue('后')
    await nextTick()
    const labels = [...document.querySelectorAll('[role="treeitem"]')].map((el) => el.textContent)
    expect(labels.some((text) => text?.includes('后端'))).toBe(true)
    expect(labels.some((text) => text?.includes('设计'))).toBe(false)
  })

  it('clears the value', async () => {
    const wrapper = withModel({ modelValue: 'design', clearable: true })
    await wrapper.get('.dou-select__clear').trigger('click')
    expect(wrapper.props('modelValue')).toBeNull()
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })
})
