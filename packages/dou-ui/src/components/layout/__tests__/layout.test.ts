import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DouLayout,
  DouLayoutAside,
  DouLayoutAsideTrigger,
  DouLayoutFooter,
  DouLayoutHeader,
  DouLayoutMain,
} from '../../../index'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

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

  it('turns the aside into a drawer below its breakpoint', async () => {
    let narrow = true
    const listeners = new Set<() => void>()
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return query === '(max-width: 767.98px)' && narrow
      },
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }))
    const wrapper = mount(DouLayout, {
      slots: {
        default: () => [
          h(DouLayoutHeader, null, () => h(DouLayoutAsideTrigger)),
          h(DouLayout, null, () => [
            h(
              DouLayoutAside,
              { breakpoint: 768 },
              {
                default: ({ drawer, close }: { drawer: boolean; close: () => void }) =>
                  h('button', { class: 'item', onClick: close }, drawer ? '抽屉' : '侧栏'),
              },
            ),
            h(DouLayoutMain),
          ]),
        ],
      },
      attachTo: document.body,
    })
    await nextTick()
    expect(wrapper.find('aside').exists()).toBe(false)
    const trigger = wrapper.get('.dou-layout-aside-trigger')
    expect(trigger.attributes('aria-label')).toBe('打开侧栏')
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')
    await nextTick()
    const panel = document.querySelector<HTMLElement>('.dou-layout-aside-drawer')!
    expect(panel.getAttribute('role')).toBe('dialog')
    expect(panel.id).toBe(trigger.attributes('aria-controls'))
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(panel.textContent).toContain('抽屉')

    panel.querySelector<HTMLElement>('.item')!.click()
    await nextTick()
    expect(trigger.attributes('aria-expanded')).toBe('false')

    narrow = false
    for (const listener of listeners) listener()
    await nextTick()
    expect(wrapper.get('aside').text()).toBe('侧栏')
    expect(wrapper.find('.dou-layout-aside-trigger').exists()).toBe(false)
    wrapper.unmount()
  })
})
