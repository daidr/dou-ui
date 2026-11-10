import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, vShow, withDirectives } from 'vue'
import { describe, expect, it } from 'vitest'
import { DouButton, DouCopyButton, DouInput, DouInputNumber, DouPopover } from '../../../index'

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

  it('marks the edge again when the outer button is hidden with v-show', async () => {
    const shown = ref(true)
    const wrapper = mount(DouInput, {
      slots: {
        suffix: () => [
          '元',
          withDirectives(
            h(DouButton, null, () => '发送'),
            [[vShow, shown.value]],
          ),
        ],
      },
      attachTo: document.body,
    })
    await nextTick()
    expect(suffix(wrapper).classes()).toContain('is-edge-action')
    shown.value = false
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve))
    expect(suffix(wrapper).classes()).not.toContain('is-edge-action')
    wrapper.unmount()
  })

  it('leaves the buttons in a panel the suffix opens alone', async () => {
    const wrapper = mount(DouInput, {
      props: { disabled: true },
      slots: {
        suffix: () => [
          h(
            DouPopover,
            { open: true, title: '选项' },
            {
              default: () => h(DouButton, null, () => '更多'),
              content: () => h(DouButton, { id: 'in-panel' }, () => '确定'),
            },
          ),
        ],
      },
      attachTo: document.body,
    })
    await nextTick()
    const inside = document.getElementById('in-panel')!
    expect(inside.classList.contains('is-field-action')).toBe(false)
    expect(inside.hasAttribute('disabled')).toBe(false)
    expect(wrapper.get('.dou-input__suffix .dou-button').classes()).toContain('is-field-action')
    wrapper.unmount()
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
