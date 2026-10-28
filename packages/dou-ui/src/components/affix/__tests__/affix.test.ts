import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { DouAffix } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const rect = (top: number) =>
  ({
    top,
    bottom: top + 40,
    left: 24,
    right: 224,
    width: 200,
    height: 40,
    x: 24,
    y: top,
  }) as DOMRect

describe('DouAffix', () => {
  it('pins the content once it reaches the offset and keeps its place', async () => {
    let top = 120
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => rect(top))
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(40)
    const wrapper = mount(DouAffix, {
      props: { offsetTop: 16, target: () => window },
      slots: { default: '<nav>目录</nav>' },
      attachTo: document.body,
    })
    const root = wrapper.element as HTMLElement
    const content = wrapper.get('.dou-affix__content').element as HTMLElement

    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(wrapper.emitted('change')).toBeUndefined()

    top = 10
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(wrapper.emitted('change')).toEqual([[true]])
    expect(content.classList).toContain('is-fixed')
    expect(content.style.position).toBe('fixed')
    expect(content.style.top).toBe('16px')
    expect(content.style.width).toBe('200px')
    expect(root.style.height).toBe('40px')

    top = 40
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(wrapper.emitted('change')!.at(-1)).toEqual([false])
    expect(content.style.position).toBe('')
    wrapper.unmount()
  })
})
