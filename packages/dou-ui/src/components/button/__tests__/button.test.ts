import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import DouUI, { DouButton } from '../../../index'

describe('DouButton', () => {
  it('renders the default slot', () => {
    const wrapper = mount(DouButton, { slots: { default: 'Save' } })
    expect(wrapper.text()).toBe('Save')
  })

  it('applies variant, tone and size classes', () => {
    const wrapper = mount(DouButton, { props: { variant: 'soft', tone: 'danger', size: 'lg' } })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining([
        'dou-button',
        'dou-button--soft',
        'dou-button--danger',
        'dou-button--lg',
      ]),
    )
  })

  it('uses sensible defaults', () => {
    const wrapper = mount(DouButton)
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-button--solid', 'dou-button--neutral', 'dou-button--md']),
    )
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('emits click', async () => {
    const wrapper = mount(DouButton)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('does not emit click when disabled', async () => {
    const wrapper = mount(DouButton, { props: { disabled: true } })
    expect(wrapper.attributes('disabled')).toBeDefined()
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('stays focusable but inert while loading', async () => {
    const wrapper = mount(DouButton, { props: { loading: true }, slots: { leading: 'icon' } })
    expect(wrapper.attributes('disabled')).toBeUndefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.classes()).toContain('is-loading')
    expect(wrapper.find('.dou-button__spinner').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('icon')
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('renders leading and trailing slots', () => {
    const wrapper = mount(DouButton, {
      slots: { leading: () => h('i', 'L'), default: 'Label', trailing: () => h('i', 'T') },
    })
    expect(wrapper.findAll('.dou-button__icon')).toHaveLength(2)
    expect(wrapper.text()).toBe('LLabelT')
  })

  it('can be installed globally', () => {
    const app = createApp({})
    app.use(DouUI)
    expect(app.component('DouButton')).toBe(DouButton)
  })
})
