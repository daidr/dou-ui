import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouCopyButton } from '../../../index'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const mockClipboard = () => {
  const writeText = vi.fn<(text: string) => Promise<void>>(async () => {})
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  return writeText
}

describe('DouCopyButton', () => {
  it('copies the text and says so for a while', async () => {
    vi.useFakeTimers()
    const writeText = mockClipboard()
    const wrapper = mount(DouCopyButton, { props: { text: 'bun add dou-ui', duration: 1000 } })
    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('复制')
    expect(button.attributes('type')).toBe('button')

    await button.trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('bun add dou-ui')
    expect(wrapper.emitted('copy')).toEqual([['bun add dou-ui']])
    expect(button.classes()).toContain('is-copied')
    expect(button.attributes('aria-label')).toBe('已复制')
    expect(wrapper.get('[role="status"]').text()).toBe('已复制')

    await vi.advanceTimersByTimeAsync(1000)
    expect(button.classes()).not.toContain('is-copied')
  })

  it('reads the text from a function when pressed', async () => {
    const writeText = mockClipboard()
    let value = 'a'
    const wrapper = mount(DouCopyButton, { props: { text: async () => value } })
    value = 'b'
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('b')
  })

  it('reports a failure', async () => {
    const writeText = mockClipboard()
    writeText.mockRejectedValue(new Error('denied'))
    const exec = vi.fn<() => boolean>(() => false)
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true })
    const wrapper = mount(DouCopyButton, { props: { text: 'x' } })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(exec).toHaveBeenCalledWith('copy')
    expect(wrapper.emitted('error')).toHaveLength(1)
    expect(wrapper.get('button').classes()).not.toContain('is-copied')
  })

  it('shows its label when asked', () => {
    const wrapper = mount(DouCopyButton, {
      props: { text: 'x', showLabel: true, label: '复制代码' },
    })
    expect(wrapper.get('.dou-copy-button__label').text()).toBe('复制代码')
  })
})
