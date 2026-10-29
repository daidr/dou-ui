import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  DouLayout,
  DouLayoutAside,
  DouLayoutFooter,
  DouLayoutHeader,
  DouLayoutMain,
} from '../../../index'

describe('DouLayout', () => {
  it('renders the page landmarks', () => {
    const wrapper = mount(DouLayout, {
      slots: {
        default: () => [
          h(DouLayoutHeader, null, () => '顶栏'),
          h(DouLayout, null, () => [
            h(DouLayoutAside, null, () => '侧栏'),
            h(DouLayoutMain, null, () => '内容'),
          ]),
          h(DouLayoutFooter, null, () => '页脚'),
        ],
      },
    })
    expect(wrapper.find('header.dou-layout-header').text()).toBe('顶栏')
    expect(wrapper.find('aside.dou-layout-aside').text()).toBe('侧栏')
    expect(wrapper.find('main.dou-layout-main').text()).toBe('内容')
    expect(wrapper.find('footer.dou-layout-footer').text()).toBe('页脚')
    expect(wrapper.find('.dou-layout-header').attributes('style')).toContain(
      '--dou-layout-header-height: 56px',
    )
  })

  it('collapses the aside from its button', async () => {
    const wrapper = mount(DouLayoutAside, {
      props: {
        collapsible: true,
        collapsed: false,
        'onUpdate:collapsed': (value: boolean) => wrapper.setProps({ collapsed: value }),
      },
      slots: { default: ({ collapsed }: { collapsed: boolean }) => (collapsed ? '图标' : '菜单') },
    })
    expect(wrapper.attributes('style')).toContain('--dou-layout-aside-width: 240px')
    const toggle = wrapper.get('.dou-layout-aside__toggle')
    expect(toggle.attributes('aria-label')).toBe('收起侧栏')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    await toggle.trigger('click')
    expect(wrapper.props('collapsed')).toBe(true)
    expect(wrapper.classes()).toContain('is-collapsed')
    expect(wrapper.attributes('style')).toContain('--dou-layout-aside-width: 64px')
    expect(wrapper.find('.dou-layout-aside__body').text()).toBe('图标')
    expect(toggle.attributes('aria-label')).toBe('展开侧栏')
  })

  it('keeps a sticky aside below a sticky header', async () => {
    const wrapper = mount(DouLayout, {
      slots: {
        default: () => [
          h(DouLayoutHeader, { sticky: true, height: 64 }),
          h(DouLayout, null, () => [h(DouLayoutAside, { sticky: true }), h(DouLayoutMain)]),
        ],
      },
    })
    await nextTick()
    expect(wrapper.find('.dou-layout-aside').attributes('style')).toContain(
      '--dou-layout-aside-top: 64px',
    )
  })
})
