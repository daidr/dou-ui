import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouConfigProvider, DouSteps, en } from '../../../index'
import { h, nextTick } from 'vue'

const items = [
  { title: '填写信息' },
  { title: '确认订单', description: '核对金额' },
  { title: '完成支付' },
  { title: '发货', disabled: true },
]

/** The row needs `need` px with every title, `compact` px with only the current one. */
function sizes(need: number, compact: number, width: { value: number }) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('dou-steps') ? width.value : 0
  })
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (!this.classList.contains('dou-steps')) return 0
    return Math.max(width.value, this.classList.contains('is-compact') ? compact : need)
  })
}

describe('DouSteps', () => {
  it('works out each status from current', () => {
    const wrapper = mount(DouSteps, { props: { items, current: 1 } })
    const steps = wrapper.findAll('li')
    expect(
      steps.map((step) => step.classes().find((c) => /^is-(wait|process|finish|error)$/.test(c))),
    ).toEqual(['is-finish', 'is-process', 'is-wait', 'is-wait'])
    expect(steps[1]!.attributes('aria-current')).toBe('step')
    expect(steps[0]!.attributes('aria-current')).toBeUndefined()
    expect(wrapper.findAll('.dou-steps__line')).toHaveLength(3)
    expect(steps[1]!.find('.dou-steps__description').text()).toBe('核对金额')
    // screen readers hear the status after the title
    expect(steps[0]!.find('.dou-steps__status').text()).toBe('已完成')
  })

  it('marks the current step as failed', () => {
    const wrapper = mount(DouSteps, { props: { items, current: 2, status: 'error' } })
    expect(wrapper.findAll('li')[2]!.classes()).toContain('is-error')
  })

  it('jumps to a clicked step only when clickable', async () => {
    const wrapper = mount(DouSteps, { props: { items, current: 2 } })
    expect(wrapper.find('button').exists()).toBe(false)

    await wrapper.setProps({ clickable: true })
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(4)
    expect(buttons[3]!.attributes('disabled')).toBeDefined()
    await buttons[0]!.trigger('click')
    expect(wrapper.emitted('update:current')).toEqual([[0]])
    expect(wrapper.emitted('change')).toEqual([[0]])
  })

  it('lays out vertically', () => {
    const wrapper = mount(DouSteps, { props: { items, direction: 'vertical', size: 'sm' } })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-steps--vertical', 'dou-steps--sm']),
    )
  })

  it('reads the status in the configured language', () => {
    const wrapper = mount(DouConfigProvider, {
      props: { locale: en },
      slots: { default: () => h(DouSteps, { items, current: 1 }) },
    })
    expect(wrapper.findAll('.dou-steps__status').map((s) => s.text())).toEqual([
      'completed',
      'current',
      'not started',
      'not started',
    ])
  })

  describe('when the row does not fit', () => {
    afterEach(() => vi.restoreAllMocks())

    it('keeps only the current title and shows the rest when room comes back', async () => {
      const width = { value: 300 }
      const observers: ResizeObserverCallback[] = []
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(callback: ResizeObserverCallback) {
            observers.push(callback)
          }
          observe() {}
          disconnect() {}
        },
      )
      sizes(600, 280, width)
      const wrapper = mount(DouSteps, { props: { items, current: 1 } })
      await nextTick()
      expect(wrapper.classes()).toContain('is-compact')
      // the hidden titles still read out
      expect(wrapper.findAll('.dou-steps__title').map((t) => t.text())).toHaveLength(4)

      width.value = 640
      observers.forEach((callback) => callback([], {} as ResizeObserver))
      await nextTick()
      expect(wrapper.classes()).not.toContain('is-compact')
      vi.unstubAllGlobals()
    })

    it('stays as it is when everything fits, and never compacts vertically', async () => {
      const width = { value: 600 }
      sizes(500, 280, width)
      expect(mount(DouSteps, { props: { items } }).classes()).not.toContain('is-compact')
      width.value = 200
      const vertical = mount(DouSteps, { props: { items, direction: 'vertical' } })
      await nextTick()
      expect(vertical.classes()).not.toContain('is-compact')
    })
  })
})
