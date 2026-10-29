import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouEllipsis } from '../../../index'

afterEach(() => vi.restoreAllMocks())

/** Pretend the text is `full` px tall when not clamped, and lines are 20px. */
function fakeText(full: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('dou-ellipsis__text') ? full : 0
  })
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (!this.classList.contains('dou-ellipsis__text')) return 0
    return this.closest('.is-expanded') ? full : 40
  })
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    lineHeight: '20px',
    fontSize: '14px',
  } as CSSStyleDeclaration)
}

describe('DouEllipsis', () => {
  it('clamps to `lines` and shows a toggle only when the text is cut off', async () => {
    fakeText(100)
    const wrapper = mount(DouEllipsis, {
      props: { lines: 2, expandable: true },
      slots: { default: () => '很长的一段说明文字' },
    })
    await nextTick()
    expect(wrapper.get('.dou-ellipsis').attributes('style')).toContain('--dou-ellipsis-lines: 2')
    const toggle = wrapper.get('.dou-ellipsis__toggle')
    expect(toggle.text()).toBe('展开')
    expect(toggle.attributes('aria-expanded')).toBe('false')

    await toggle.trigger('click')
    expect(wrapper.get('.dou-ellipsis').classes()).toContain('is-expanded')
    expect(wrapper.get('.dou-ellipsis__toggle').text()).toBe('收起')
    expect(wrapper.emitted('update:expanded')).toEqual([[true]])
  })

  it('has no toggle when the text fits', async () => {
    fakeText(40)
    const wrapper = mount(DouEllipsis, {
      props: { lines: 2, expandable: true },
      slots: { default: () => '短' },
    })
    await nextTick()
    expect(wrapper.find('.dou-ellipsis__toggle').exists()).toBe(false)
    expect(wrapper.get('.dou-ellipsis').classes()).not.toContain('is-truncated')
  })

  it('only sets up a tooltip when `tooltip` is on', () => {
    fakeText(100)
    const plain = mount(DouEllipsis, { slots: { default: '上海' } })
    expect(plain.findComponent({ name: 'DouTooltip' }).exists()).toBe(false)
    const root = plain.get('.dou-ellipsis')
    expect(root.attributes('disabled')).toBeUndefined()
    expect(root.attributes('placement')).toBeUndefined()
    const tipped = mount(DouEllipsis, { props: { tooltip: true }, slots: { default: '上海' } })
    expect(tipped.findComponent({ name: 'DouTooltip' }).exists()).toBe(true)
  })
})
