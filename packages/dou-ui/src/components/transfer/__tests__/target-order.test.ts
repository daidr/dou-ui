import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouTransfer } from '../../../index'

const data = [
  { key: 1, label: '甲' },
  { key: 2, label: '乙' },
  { key: 3, label: '丙' },
  { key: 4, label: '丁' },
]

async function move(targetOrder: 'original' | 'push' | 'unshift') {
  const wrapper = mount(DouTransfer, {
    props: { data, modelValue: [4, 2], targetOrder },
    attachTo: document.body,
  })
  const source = wrapper.findAll('section')[0]!
  // check 甲 and 丙
  const boxes = source.findAll('input[type="checkbox"]')
  await boxes[1]!.setValue(true)
  await boxes[2]!.setValue(true)
  await wrapper.findAll('.dou-transfer__actions button')[0]!.trigger('click')
  const value = wrapper.emitted('update:modelValue')!.at(-1)![0]
  wrapper.unmount()
  return value
}

describe('DouTransfer targetOrder', () => {
  it('appends by default', async () => {
    expect(await move('push')).toEqual([4, 2, 1, 3])
  })
  it('puts moved items first with unshift', async () => {
    expect(await move('unshift')).toEqual([1, 3, 4, 2])
  })
  it('follows the order of data with original', async () => {
    expect(await move('original')).toEqual([1, 2, 3, 4])
  })
})
