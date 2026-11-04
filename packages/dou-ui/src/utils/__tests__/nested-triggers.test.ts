import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DouButton,
  DouCollapse,
  DouCollapseItem,
  DouDropdown,
  DouDropdownButton,
  DouPopconfirm,
  DouPopover,
  DouTooltip,
} from '../../index'

const tooltip = () => document.querySelector<HTMLElement>('[role="tooltip"]')
const popover = () => document.querySelector<HTMLElement>('.dou-popover')
const visible = (el: HTMLElement | null) => !!el && el.style.display !== 'none'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

async function hover(el: Element) {
  el.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
  vi.advanceTimersByTime(200)
  await nextTick()
}

describe('a tooltip around another overlay trigger', () => {
  it('tooltip outside a popover: hover shows the tip, click opens the popover', async () => {
    const wrapper = mount(
      () =>
        h(DouTooltip, { content: '筛选' }, () =>
          h(DouPopover, { title: '筛选条件', content: '面板' }, () =>
            h('button', { id: 't', 'aria-label': '筛选' }, 'x'),
          ),
        ),
      { attachTo: document.body },
    )
    const button = wrapper.get('#t').element as HTMLElement

    await hover(button)
    expect(visible(tooltip())).toBe(true)

    button.click()
    await nextTick()
    expect(visible(popover())).toBe(true)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    // the popover's panel took neither listener
    expect(popover()!.hasAttribute('aria-describedby')).toBe(false)
    // the tip gives way to the panel it opened
    await flushPromises()
    expect(visible(tooltip())).toBe(false)

    button.click()
    await nextTick()
    expect(visible(popover())).toBe(false)
    wrapper.unmount()
  })

  it('popover outside a tooltip works the same', async () => {
    const wrapper = mount(
      () =>
        h(DouPopover, { content: '面板' }, () =>
          h(DouTooltip, { content: '筛选' }, () => h('button', { id: 't' }, '筛选按钮')),
        ),
      { attachTo: document.body },
    )
    const button = wrapper.get('#t').element as HTMLElement
    await hover(button)
    expect(visible(tooltip())).toBe(true)
    button.click()
    await nextTick()
    expect(visible(popover())).toBe(true)
    wrapper.unmount()
  })

  it('keeps both on the element from a template, with a component trigger', async () => {
    const open = ref(false)
    const Demo = defineComponent({
      components: { DouTooltip, DouPopover, DouButton },
      setup: () => ({ open }),
      template: `
        <DouTooltip content="更多设置">
          <DouPopover v-model:open="open" content="面板">
            <DouButton id="t" aria-label="设置">S</DouButton>
          </DouPopover>
        </DouTooltip>`,
    })
    const wrapper = mount(Demo, { attachTo: document.body })
    const button = wrapper.get('#t').element as HTMLElement
    await hover(button)
    expect(button.getAttribute('aria-describedby')).toBe(tooltip()!.id)

    button.click()
    await nextTick()
    expect(open.value).toBe(true)

    // Escape closes the popover and focus stays usable
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(open.value).toBe(false)
    wrapper.unmount()
  })

  it('keyboard: focus shows the tip, Enter opens the popover', async () => {
    const wrapper = mount(
      () =>
        h(DouTooltip, { content: '筛选' }, () =>
          h(DouPopover, { content: '面板' }, () => h('button', { id: 't' }, '按钮')),
        ),
      { attachTo: document.body },
    )
    const button = wrapper.get('#t')
    await button.trigger('focusin')
    expect(visible(tooltip())).toBe(true)
    // a button turns Enter into a click
    await button.trigger('click')
    expect(visible(popover())).toBe(true)
    await flushPromises()
    expect(visible(tooltip())).toBe(false)
    wrapper.unmount()
  })

  it('touch: a tap opens the popover and shows no tip', async () => {
    const wrapper = mount(
      () =>
        h(DouTooltip, { content: '筛选' }, () =>
          h(DouPopover, { content: '面板' }, () => h('button', { id: 't' }, '按钮')),
        ),
      { attachTo: document.body },
    )
    const button = wrapper.get('#t').element as HTMLElement
    button.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }))
    button.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }))
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    button.click()
    vi.advanceTimersByTime(300)
    await nextTick()
    expect(visible(popover())).toBe(true)
    expect(visible(tooltip())).toBe(false)
    wrapper.unmount()
  })

  it('opens a dropdown and a popconfirm under a tooltip', async () => {
    const wrapper = mount(
      () => [
        h(DouTooltip, { content: '更多' }, () =>
          h(DouDropdown, { items: [{ key: 'a', label: '甲' }] }, () =>
            h('button', { id: 'd' }, '更多'),
          ),
        ),
        h(DouTooltip, { content: '删除' }, () =>
          h(DouPopconfirm, { title: '确定删除？' }, () => h('button', { id: 'p' }, '删除')),
        ),
      ],
      { attachTo: document.body },
    )
    const d = wrapper.get('#d').element as HTMLElement
    d.click()
    await nextTick()
    expect(d.getAttribute('aria-expanded')).toBe('true')

    const p = wrapper.get('#p').element as HTMLElement
    p.click()
    await nextTick()
    expect(p.getAttribute('aria-expanded')).toBe('true')
    wrapper.unmount()
  })

  it('still updates the inner trigger when the outer one re-renders', async () => {
    const label = ref('甲')
    const wrapper = mount(
      () =>
        h(DouTooltip, { content: '提示' }, () =>
          h(DouPopover, { content: '面板' }, () => h('button', { id: 't' }, label.value)),
        ),
      { attachTo: document.body },
    )
    label.value = '乙'
    await nextTick()
    expect(wrapper.get('#t').text()).toBe('乙')
    wrapper.unmount()
  })

  it('gives way to a menu opened by a button inside the trigger', async () => {
    const wrapper = mount(
      () =>
        h(DouTooltip, { content: '保存选项' }, () =>
          h(
            DouDropdownButton,
            { items: [{ key: 'a', label: '另存为' }] },
            { default: () => '保存' },
          ),
        ),
      { attachTo: document.body },
    )
    const root = wrapper.get('.dou-dropdown-button').element as HTMLElement
    await hover(root)
    expect(visible(tooltip())).toBe(true)
    const arrow = root.querySelector<HTMLElement>('[aria-haspopup]')!
    arrow.click()
    await nextTick()
    await flushPromises()
    expect(arrow.getAttribute('aria-expanded')).toBe('true')
    expect(visible(tooltip())).toBe(false)
    wrapper.unmount()
  })

  it('warns while developing when the trigger gets none of the listeners', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // a wrapper whose root is a dropdown: its attributes go on the dropdown's panel
    const MyMenu = defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h(DouDropdown, { items: [{ key: 'a', label: '甲' }] }, () => slots.default?.()),
    })
    const wrapper = mount(
      () => h(DouTooltip, { content: '更多' }, () => h(MyMenu, null, () => h('button', '更多'))),
      { attachTo: document.body },
    )
    expect(
      warn.mock.calls.some(([m]) => String(m).includes('DouTooltip: its trigger got none')),
    ).toBe(true)
    wrapper.unmount()

    warn.mockClear()
    const fine = mount(
      () =>
        h(DouTooltip, { content: '更多' }, () =>
          h(DouDropdown, { items: [{ key: 'a', label: '甲' }] }, () => h('button', '更多')),
        ),
      { attachTo: document.body },
    )
    expect(warn.mock.calls.some(([m]) => String(m).includes('got none'))).toBe(false)
    fine.unmount()
    warn.mockRestore()
  })

  it('still shows over a trigger that holds something expanded but no open popup', async () => {
    const wrapper = mount(
      () =>
        h(DouTooltip, { content: '区域说明' }, () =>
          h('div', { id: 'area', tabindex: 0 }, [
            h(DouCollapse, { modelValue: ['a'] }, () =>
              h(DouCollapseItem, { value: 'a', title: '甲' }, () => '内容'),
            ),
          ]),
        ),
      { attachTo: document.body },
    )
    const area = wrapper.get('#area').element as HTMLElement
    expect(area.querySelector('[aria-expanded="true"]')).not.toBeNull()
    await hover(area)
    expect(visible(tooltip())).toBe(true)
    wrapper.unmount()
  })
})
