import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouBackTop } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DouBackTop', () => {
  it('appears once the area scrolls far enough and goes back to the top', async () => {
    const area = document.createElement('div')
    document.body.append(area)
    const scrollTo = vi.fn<(options: ScrollToOptions) => void>()
    area.scrollTo = scrollTo as typeof area.scrollTo
    const wrapper = mount(DouBackTop, {
      props: { target: area, visibilityHeight: 100, right: 16, bottom: 32 },
      attachTo: document.body,
    })
    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('回到顶部')
    expect(button.attributes('style')).toContain('right: 16px')
    expect(button.isVisible()).toBe(false)

    area.scrollTop = 150
    area.dispatchEvent(new Event('scroll'))
    await wrapper.vm.$nextTick()
    expect(button.isVisible()).toBe(true)

    await button.trigger('click')
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
    expect(wrapper.emitted('click')).toHaveLength(1)
    wrapper.unmount()
  })
})
