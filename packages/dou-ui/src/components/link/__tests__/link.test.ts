import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import {
  Fragment,
  createCommentVNode,
  createTextVNode,
  defineComponent,
  h,
  nextTick,
  ref,
} from 'vue'
import { DouLink } from '../../../index'

describe('DouLink', () => {
  it('renders an anchor with defaults', () => {
    const wrapper = mount(DouLink, { props: { href: '/docs' }, slots: { default: '文档' } })
    expect(wrapper.element.tagName).toBe('A')
    expect(wrapper.attributes('href')).toBe('/docs')
    expect(wrapper.text()).toBe('文档')
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-link', 'dou-link--neutral', 'dou-link--underline-always']),
    )
  })

  it('drops the underline for a soft link unless one is asked for', () => {
    const soft = mount(DouLink, { props: { href: '/a', variant: 'soft' } })
    expect(soft.classes()).toEqual(
      expect.arrayContaining(['dou-link--soft', 'dou-link--underline-none']),
    )
    const underlined = mount(DouLink, {
      props: { href: '/a', variant: 'soft', underline: 'hover' },
    })
    expect(underlined.classes()).toContain('dou-link--underline-hover')
  })

  it('trims a label passed on by a wrapper, or after a v-if', () => {
    const Wrapper = defineComponent({
      setup(_, { slots }) {
        return () =>
          h(DouLink, { href: '/a', variant: 'soft' }, { default: () => slots.default?.() })
      },
    })
    const passed = mount(Wrapper, {
      slots: { default: () => [createTextVNode('\n  #128 排班\n  ')] },
    })
    expect(passed.get('.dou-link__label').element.textContent).toBe('#128 排班')
    const Forwarded = defineComponent({
      setup(_, { slots }) {
        return () => h(DouLink, { href: '/a' }, { default: () => [h(Fragment, slots.default?.())] })
      },
    })
    const fragment = mount(Forwarded, { slots: { default: () => [createTextVNode(' 共 3 条 ')] } })
    expect(fragment.get('.dou-link__label').element.textContent).toBe('共 3 条')
    const afterIf = mount(DouLink, {
      props: { href: '/a' },
      slots: { default: () => [createCommentVNode('v-if'), createTextVNode(' 共 3 条')] },
    })
    expect(afterIf.get('.dou-link__label').element.textContent).toBe('共 3 条')
  })

  it('keeps a soft link’s icons on the line of the words beside them', () => {
    const wrapper = mount(DouLink, {
      props: { href: '/a', variant: 'soft', external: true },
      slots: { leading: '<i>i</i>', default: '\n  会议纪要\n  ' },
    })
    expect(wrapper.get('.dou-link__lead').text()).toBe('i会')
    expect(wrapper.get('.dou-link__label').element.textContent).toBe('议纪')
    expect(wrapper.get('.dou-link__trail').text()).toBe('要')
    expect(wrapper.find('.dou-link__trail .dou-link__external').exists()).toBe(true)
    // nothing is added to what is read out or copied
    expect(wrapper.element.textContent).toBe('i会议纪要')
    const plain = mount(DouLink, {
      props: { href: '/a', external: true },
      slots: { leading: '<i>i</i>', default: '文档' },
    })
    expect(plain.find('.dou-link__lead').exists()).toBe(false)
    expect(plain.get('.dou-link__label').text()).toBe('文档')
  })

  it('keeps a single character and both icons together', () => {
    const wrapper = mount(DouLink, {
      props: { href: '/a', variant: 'soft', external: true },
      slots: { leading: '<i>i</i>', default: ' 文 ' },
    })
    const edges = wrapper.findAll('.dou-link__lead')
    expect(edges).toHaveLength(1)
    expect(edges[0]!.classes()).toContain('dou-link__trail')
    expect(edges[0]!.findAll('.dou-link__icon')).toHaveLength(2)
    expect(wrapper.element.textContent).toBe('i文')
  })

  it('looks past a fragment that holds only spaces', () => {
    const Wrapper = defineComponent({
      setup(_, { slots }) {
        return () =>
          h(
            DouLink,
            { href: '/a', variant: 'soft' },
            {
              leading: () => h('i', 'i'),
              // an empty named slot passed on before the default one
              default: () => [h(Fragment, slots.prefix?.() ?? []), h(Fragment, slots.default?.())],
            },
          )
      },
    })
    const wrapper = mount(Wrapper, {
      slots: { prefix: () => [createTextVNode('  ')], default: () => [createTextVNode(' 周会 ')] },
    })
    expect(wrapper.get('.dou-link__lead').text()).toBe('i周')
    expect(wrapper.get('.dou-link__label').element.textContent).toBe('会')
  })

  it('shows an icon slot that comes later', async () => {
    for (const variant of ['text', 'soft'] as const) {
      const on = ref(false)
      const wrapper = mount(
        defineComponent({
          setup: () => () =>
            h(
              DouLink,
              { href: '/a', variant },
              on.value
                ? { leading: () => h('i', 'l'), trailing: () => h('i', 't'), default: () => '文档' }
                : { default: () => '文档' },
            ),
        }),
      )
      expect(wrapper.findAll('.dou-link__icon')).toHaveLength(0)
      on.value = true
      await nextTick()
      expect(wrapper.findAll('.dou-link__icon')).toHaveLength(2)
      expect(wrapper.text()).toBe('l文档t')
    }
  })

  it('trims the spaces a label on its own lines brings', () => {
    const wrapper = mount(DouLink, {
      props: { href: '/a' },
      slots: { default: '\n  周会纪要\n  ' },
    })
    expect(wrapper.get('.dou-link__label').element.textContent).toBe('周会纪要')
  })

  it('opens external links safely in a new tab', () => {
    const wrapper = mount(DouLink, { props: { href: 'https://example.com', external: true } })
    expect(wrapper.attributes('target')).toBe('_blank')
    expect(wrapper.attributes('rel')).toBe('noopener noreferrer')
    expect(wrapper.find('.dou-link__external').exists()).toBe(true)
  })

  it('lets the trailing slot replace the external arrow', () => {
    const wrapper = mount(DouLink, {
      props: { href: 'https://example.com', external: true },
      slots: { trailing: '→' },
    })
    expect(wrapper.find('.dou-link__external').exists()).toBe(false)
    expect(wrapper.text()).toContain('→')
  })

  it('treats icon slots that render nothing as not passed', async () => {
    const wrapper = mount({
      components: { DouLink },
      props: { icon: { type: Boolean, default: false } },
      template: `
        <DouLink href="https://example.com" external>
          <template #leading><svg v-if="icon" class="lead" /></template>
          文档
          <template #trailing><svg v-if="icon" class="trail" /></template>
        </DouLink>
      `,
    })
    // no empty icon in front, and the external arrow stays
    expect(wrapper.findAll('.dou-link__icon')).toHaveLength(1)
    expect(wrapper.find('.dou-link__external').exists()).toBe(true)
    await wrapper.setProps({ icon: true })
    expect(wrapper.find('.dou-link__external').exists()).toBe(false)
    expect(wrapper.find('.lead').exists()).toBe(true)
    expect(wrapper.find('.trail').exists()).toBe(true)
  })

  it('drops the href and swallows clicks when disabled', async () => {
    const wrapper = mount(DouLink, { props: { href: '/docs', disabled: true } })
    expect(wrapper.attributes('href')).toBeUndefined()
    expect(wrapper.attributes('aria-disabled')).toBe('true')
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('emits click', async () => {
    const wrapper = mount(DouLink, { props: { href: '#' } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('renders a button when there is no href', async () => {
    const wrapper = mount(DouLink, { slots: { default: '重新开始' } })
    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('type')).toBe('button')
    expect(wrapper.attributes('href')).toBeUndefined()
    expect(wrapper.classes()).toContain('dou-link')
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('disables the button natively', () => {
    const wrapper = mount(DouLink, { props: { disabled: true } })
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-disabled')).toBeUndefined()
  })

  it('warns that external does nothing without an href', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(DouLink, { props: { external: true } })
    expect(wrapper.find('.dou-link__external').exists()).toBe(false)
    expect(wrapper.attributes('target')).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[dou-ui] DouLink'))
    warn.mockRestore()
  })

  it('warns when the button form sits inside another button', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const host = document.createElement('button')
    document.body.append(host)
    const wrapper = mount(DouLink, { slots: { default: '展开' }, attachTo: host })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('inside another button'))
    wrapper.unmount()
    host.remove()
    warn.mockRestore()
  })

  it('does not warn about nesting when it has an href', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const host = document.createElement('button')
    document.body.append(host)
    const wrapper = mount(DouLink, { props: { href: '/a' }, attachTo: host })
    expect(warn).not.toHaveBeenCalled()
    wrapper.unmount()
    host.remove()
    warn.mockRestore()
  })
})
