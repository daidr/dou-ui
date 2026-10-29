import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouTree } from '../../../index'

const data = [
  {
    key: 'a',
    label: '设计',
    children: [
      { key: 'a1', label: '图标', children: [{ key: 'a1x', label: 'x' }] },
      { key: 'a2', label: '配色', children: [{ key: 'a2x', label: 'y' }] },
    ],
  },
  { key: 'b', label: '开发', children: [{ key: 'b1', label: '组件' }] },
]

describe('DouTree accordion', () => {
  it('closes open siblings when a branch opens', async () => {
    const wrapper = mount(DouTree, { props: { data, accordion: true, expanded: ['a', 'a1'] } })
    const toggle = (label: string) =>
      wrapper
        .findAll('.dou-tree__node')
        .find((row) => row.text().includes(label))!
        .get('.dou-tree__toggle')
        .trigger('click')
    await toggle('开发')
    const first = wrapper.emitted('update:expanded')!.at(-1)![0] as string[]
    // 'a' is a sibling of 'b'; 'a1' is not, it just stays hidden under the closed 'a'
    expect(first).not.toContain('a')
    expect(first).toContain('b')

    await wrapper.setProps({ expanded: ['a', 'a1'] })
    await toggle('配色')
    const second = wrapper.emitted('update:expanded')!.at(-1)![0] as string[]
    expect(second).toEqual(expect.arrayContaining(['a', 'a2']))
    expect(second).not.toContain('a1')
  })
})
