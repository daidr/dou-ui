import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { Comment, Fragment, createApp, h, nextTick, ref } from 'vue'
import DouUI, { DouButton, DouFieldGroup } from '../../../index'

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

  it('treats an icon in the default slot like a leading icon', () => {
    const wrapper = mount(DouButton, { slots: { default: () => h('svg', { class: 'icon' }) } })
    expect(wrapper.classes()).toContain('is-icon-only')
    expect(wrapper.find('.dou-button__label').exists()).toBe(false)
    expect(wrapper.find('.dou-button__icon .icon').exists()).toBe(true)
  })

  it('treats a component in the default slot as an icon', () => {
    const Icon = { render: () => h('svg') }
    const wrapper = mount(DouButton, { slots: { default: () => h(Icon) } })
    expect(wrapper.classes()).toContain('is-icon-only')
  })

  it('sizes an icon in the default slot as an icon next to a trailing icon', () => {
    const wrapper = mount(DouButton, {
      slots: { default: () => h('svg', { class: 'icon' }), trailing: () => h('i', 'T') },
    })
    expect(wrapper.classes()).not.toContain('is-icon-only')
    expect(wrapper.find('.dou-button__label').exists()).toBe(false)
    expect(wrapper.findAll('.dou-button__icon')).toHaveLength(2)
    expect(wrapper.find('.dou-button__icon .icon').exists()).toBe(true)
  })

  it('keeps text, even wrapped in an element, as the label', () => {
    const wrapper = mount(DouButton, {
      slots: { default: () => [h('svg'), h('span', 'Save')] },
    })
    expect(wrapper.classes()).not.toContain('is-icon-only')
    expect(wrapper.find('.dou-button__label').text()).toBe('Save')
  })

  it('is icon-only with just a leading icon, and keeps the spinner in its place', () => {
    const wrapper = mount(DouButton, {
      props: { loading: true },
      slots: { default: () => h('svg', { class: 'icon' }) },
    })
    expect(wrapper.classes()).toContain('is-icon-only')
    expect(wrapper.find('.dou-button__spinner').exists()).toBe(true)
    expect(wrapper.find('.icon').exists()).toBe(false)
    expect(mount(DouButton, { slots: { leading: () => h('svg') } }).classes()).toContain(
      'is-icon-only',
    )
    expect(mount(DouButton, { slots: { default: 'Save' } }).classes()).not.toContain('is-icon-only')
  })

  it('treats a default slot that renders nothing as not passed', async () => {
    // a count behind `v-if` next to a leading icon
    const count = ref(0)
    const wrapper = mount({
      render: () =>
        h(DouButton, null, {
          leading: () => h('svg', { class: 'bell' }),
          default: () =>
            count.value ? [String(count.value)] : [h(Fragment, [h(Comment, 'v-if')])],
        }),
    })
    const button = wrapper.get('button')
    expect(button.classes()).toContain('is-icon-only')
    expect(button.findAll('.dou-button__icon')).toHaveLength(1)
    expect(button.find('.dou-button__label').exists()).toBe(false)
    count.value = 3
    await nextTick()
    expect(button.classes()).not.toContain('is-icon-only')
    expect(button.get('.dou-button__label').text()).toBe('3')
    // blank text and an empty trailing slot count as nothing too
    const blank = mount(DouButton, {
      slots: { leading: () => h('svg'), default: () => ' ', trailing: () => [] },
    })
    expect(blank.classes()).toContain('is-icon-only')
    expect(blank.findAll('.dou-button__icon')).toHaveLength(1)
  })

  it('follows slots written in a template as they come and go', async () => {
    const wrapper = mount(
      {
        components: { DouButton },
        props: { count: { type: Number, default: 3 }, icon: { type: Boolean, default: true } },
        template: `
          <DouButton aria-label="通知">
            <template #leading><svg v-if="icon" class="bell" /></template>
            <span v-if="count">{{ count }}</span>
          </DouButton>
        `,
      },
      { attachTo: document.body },
    )
    const button = () => wrapper.get('button')
    expect(button().classes()).not.toContain('is-icon-only')
    // the count drops to 0: square again, with no empty label
    await wrapper.setProps({ count: 0 })
    expect(button().classes()).toContain('is-icon-only')
    expect(button().find('.dou-button__label').exists()).toBe(false)
    expect(button().findAll('.dou-button__icon')).toHaveLength(1)
    await wrapper.setProps({ count: 5 })
    expect(button().get('.dou-button__label').text()).toBe('5')
    // a leading icon behind a false v-if leaves no empty icon
    await wrapper.setProps({ icon: false })
    expect(button().findAll('.dou-button__icon')).toHaveLength(0)
    wrapper.unmount()
  })

  it('leaves out a slot a wrapper passes on without being given it', () => {
    const Wrapper = {
      components: { DouButton },
      template: `<DouButton><template #leading><slot name="icon" /></template>保存</DouButton>`,
    }
    const wrapper = mount(Wrapper)
    expect(wrapper.findAll('.dou-button__icon')).toHaveLength(0)
    expect(wrapper.get('.dou-button__label').text()).toBe('保存')
  })

  it('renders each slot once a render', () => {
    const calls = { leading: 0, default: 0, trailing: 0 }
    mount(DouButton, {
      slots: {
        leading: () => (calls.leading++, h('svg')),
        default: () => (calls.default++, 'Save'),
        trailing: () => (calls.trailing++, h('svg')),
      },
    })
    expect(calls).toEqual({ leading: 1, default: 1, trailing: 1 })
  })

  it('takes xs only from its own prop', () => {
    expect(mount(DouButton, { props: { size: 'xs' } }).classes()).toContain('dou-button--xs')
    const grouped = mount(DouFieldGroup, {
      props: { size: 'sm' },
      slots: {
        default: () => [h(DouButton, { size: 'xs' }, () => 'A'), h(DouButton, null, () => 'B')],
      },
    })
    const [own, inherited] = grouped.findAllComponents(DouButton)
    expect(own!.classes()).toContain('dou-button--xs')
    expect(inherited!.classes()).toContain('dou-button--sm')
  })

  it('can be installed globally', () => {
    const app = createApp({})
    app.use(DouUI)
    expect(app.component('DouButton')).toBe(DouButton)
  })
})
