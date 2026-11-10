import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { DouButton, DouCopyButton, DouInput, DouInputNumber } from '../../../index'

const suffix = (wrapper: ReturnType<typeof mount>) => wrapper.get('.dou-input__suffix')

describe('a button in the prefix or suffix of DouInput', () => {
  it('marks the side it sits at the edge of', () => {
    const wrapper = mount(DouInput, {
      slots: {
        prefix: () => [h(DouButton, null, () => '搜')],
        suffix: () => [h(DouCopyButton, { text: 'a' })],
      },
    })
    expect(wrapper.get('.dou-input__prefix').classes()).toContain('is-edge-action')
    expect(suffix(wrapper).classes()).toContain('is-edge-action')
    expect(wrapper.get('.dou-button').classes()).toContain('is-field-action')
    expect(wrapper.get('.dou-copy-button').classes()).toContain('is-field-action')
  })

  it('ignores comments and blank text beside the button', () => {
    const wrapper = mount(DouInput, {
      slots: { suffix: '<DouButton>发送</DouButton> <!-- 备注 -->' },
      global: { components: { DouButton } },
    })
    expect(suffix(wrapper).classes()).toContain('is-edge-action')
  })

  it('leaves the padding when text comes after the button', () => {
    const wrapper = mount(DouInput, {
      slots: { suffix: () => [h(DouButton, null, () => '发送'), '元'] },
    })
    expect(suffix(wrapper).classes()).not.toContain('is-edge-action')
  })

  it('leaves the padding for content that is not a button', () => {
    const wrapper = mount(DouInput, { slots: { suffix: '元' } })
    expect(suffix(wrapper).classes()).not.toContain('is-edge-action')
  })

  it('sees a button wrapped in another component once mounted', async () => {
    const Wrapped = defineComponent(() => () => h(DouButton, null, () => '发送'))
    const wrapper = mount(DouInput, {
      slots: { suffix: () => [h(Wrapped)] },
      attachTo: document.body,
    })
    await nextTick()
    expect(suffix(wrapper).classes()).toContain('is-edge-action')
    wrapper.unmount()
  })

  it('is disabled with the field', async () => {
    const wrapper = mount(DouInput, {
      props: { disabled: true },
      slots: {
        prefix: () => [h(DouButton, null, () => '搜')],
        suffix: () => [h(DouCopyButton, { text: 'a' })],
      },
    })
    expect(wrapper.get('.dou-button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.dou-copy-button').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ disabled: false })
    expect(wrapper.get('.dou-button').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('.dou-copy-button').attributes('disabled')).toBeUndefined()
  })

  it('leaves a button outside a field alone', () => {
    const wrapper = mount(DouButton, { slots: { default: '确定' } })
    expect(wrapper.classes()).not.toContain('is-field-action')
  })
})

describe('a button in the prefix or suffix of DouInputNumber', () => {
  it('is marked and disabled with the field', () => {
    const wrapper = mount(DouInputNumber, {
      props: { disabled: true },
      slots: { suffix: () => [h(DouButton, null, () => '最大')] },
    })
    expect(wrapper.get('.dou-input-number__suffix').classes()).toContain('is-edge-action')
    expect(wrapper.get('.dou-button').attributes('disabled')).toBeDefined()
  })
})
