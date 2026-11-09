import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouAutocomplete } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

const options = () =>
  [...document.querySelectorAll('[role="option"]')].map((el) => el.textContent?.trim())

describe('DouAutocomplete', () => {
  it('is a combobox on the native input', () => {
    const wrapper = mount(DouAutocomplete, { props: { options: ['Vue'] }, attachTo: document.body })
    const input = wrapper.get('input')
    expect(input.attributes('role')).toBe('combobox')
    expect(input.attributes('aria-autocomplete')).toBe('list')
    expect(input.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('filters the options by the text and marks the match', async () => {
    const wrapper = mount(DouAutocomplete, {
      props: {
        options: ['Vue', 'Vite', 'VitePress', 'Bun'],
        'onUpdate:modelValue': (v: string) => wrapper.setProps({ modelValue: v }),
      },
      attachTo: document.body,
    })
    const input = wrapper.get('input')
    await input.trigger('focus')
    await input.setValue('vi')
    expect(input.attributes('aria-expanded')).toBe('true')
    expect(options()).toEqual(['Vite', 'VitePress'])
    expect(document.querySelector('.dou-autocomplete__match')!.textContent).toBe('Vi')

    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(input.attributes('aria-activedescendant')).toBe(
      document.querySelectorAll('[role="option"]')[1]!.id,
    )
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('select')![0]).toEqual([{ value: 'VitePress' }])
    expect(wrapper.props('modelValue')).toBe('VitePress')
    expect(input.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('leaves Enter to the form while nothing is highlighted', async () => {
    const wrapper = mount(DouAutocomplete, { props: { options: ['Vue'] }, attachTo: document.body })
    const input = wrapper.get('input')
    await input.trigger('focus')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('select')).toBeUndefined()
    wrapper.unmount()
  })

  it('fetches suggestions after a pause and drops stale answers', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn<(query: string) => Promise<string[]>>(async (query) => [
      `${query}-1`,
      `${query}-2`,
    ])
    const wrapper = mount(DouAutocomplete, {
      props: {
        fetch,
        debounce: 100,
        minLength: 1,
        'onUpdate:modelValue': (v: string) => wrapper.setProps({ modelValue: v }),
      },
      attachTo: document.body,
    })
    const input = wrapper.get('input')
    await input.trigger('focus')
    await input.setValue('a')
    await input.setValue('ab')
    expect(fetch).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    await flushPromises()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('ab')
    expect(options()).toEqual(['ab-1', 'ab-2'])
    wrapper.unmount()
  })
  it('fetches for the chosen value before the list opens again', async () => {
    const fetch = vi.fn<(query: string) => string[]>((query) => [`${query}/a`, `${query}/b`])
    const wrapper = mount(DouAutocomplete, {
      props: {
        fetch,
        modelValue: '/home',
        'onUpdate:modelValue': (v: string) => wrapper.setProps({ modelValue: v }),
      },
      attachTo: document.body,
    })
    const input = wrapper.get('input')
    await input.trigger('focus')
    await flushPromises()
    expect(options()).toEqual(['/home/a', '/home/b'])
    ;(document.querySelectorAll('[role="option"]')[0] as HTMLElement).click()
    await flushPromises()
    expect(input.attributes('aria-expanded')).toBe('false')
    // focus leaves and comes back: the suggestions are for `/home/a`, not `/home`
    await input.trigger('blur')
    await input.trigger('focus')
    await flushPromises()
    expect(fetch).toHaveBeenLastCalledWith('/home/a')
    expect(options()).toEqual(['/home/a/a', '/home/a/b'])
    wrapper.unmount()
  })

  it('keeps the list open after a choice with `hideOnSelect` off, to step further in', async () => {
    let answer: ((list: string[]) => void) | undefined
    const fetch = vi.fn<(query: string) => Promise<string[]>>(
      () => new Promise((resolve) => (answer = resolve)),
    )
    const wrapper = mount(DouAutocomplete, {
      props: {
        fetch,
        hideOnSelect: false,
        modelValue: '/home',
        'onUpdate:modelValue': (v: string) => wrapper.setProps({ modelValue: v }),
      },
      attachTo: document.body,
    })
    const input = wrapper.get('input')
    await input.trigger('focus')
    answer!(['/home/a', '/home/b'])
    await flushPromises()
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.props('modelValue')).toBe('/home/a')
    // the old suggestions are gone while the new ones load
    expect(input.attributes('aria-expanded')).toBe('true')
    expect(options()).toEqual([])
    expect(document.querySelector('.dou-autocomplete__status')!.textContent).toContain('加载中')
    expect(fetch).toHaveBeenLastCalledWith('/home/a')
    answer!(['/home/a/x'])
    await flushPromises()
    expect(options()).toEqual(['/home/a/x'])
    expect(input.attributes('aria-expanded')).toBe('true')
    wrapper.unmount()
  })
})

describe('DouAutocomplete highlight', () => {
  it('keeps the highlight when the parent passes an equal list again', async () => {
    const wrapper = mount(DouAutocomplete, {
      props: {
        modelValue: '',
        options: ['Vue', 'Vite', 'VitePress'],
        'onUpdate:modelValue': (v: string) => wrapper.setProps({ modelValue: v }),
      },
      attachTo: document.body,
    })
    const input = wrapper.get('input')
    await input.trigger('focus')
    await input.setValue('vi')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    const second = document.querySelectorAll('[role="option"]')[1]!.id
    expect(input.attributes('aria-activedescendant')).toBe(second)
    await wrapper.setProps({ options: ['Vue', 'Vite', 'VitePress'] })
    expect(input.attributes('aria-activedescendant')).toBe(second)
    wrapper.unmount()
  })

  it('leaves Enter to the input method while composing', async () => {
    const wrapper = mount(DouAutocomplete, {
      props: {
        options: ['上海', '上海虹桥'],
        'onUpdate:modelValue': (v: string) => wrapper.setProps({ modelValue: v }),
      },
      attachTo: document.body,
    })
    const input = wrapper.get('input')
    await input.trigger('focus')
    await input.setValue('上')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter', isComposing: true })
    await input.trigger('keydown', { key: 'Enter', keyCode: 229 })
    expect(wrapper.props('modelValue')).toBe('上')
    wrapper.unmount()
  })

  it('runs over several lines when multiline', async () => {
    const wrapper = mount(DouAutocomplete, {
      props: {
        options: ['Vue', 'Vite'],
        multiline: true,
        'onUpdate:modelValue': (v: string) => wrapper.setProps({ modelValue: v }),
      },
      attachTo: document.body,
    })
    const area = wrapper.get('textarea')
    expect(area.attributes('role')).toBe('combobox')
    await area.trigger('focus')
    await area.trigger('keydown', { key: 'Escape' })
    expect(area.attributes('aria-expanded')).toBe('false')
    // With the list closed the arrows are left to the caret.
    const down = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true })
    area.element.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(false)
    expect(area.attributes('aria-expanded')).toBe('false')
    await area.setValue('v')
    expect(area.attributes('aria-expanded')).toBe('true')
    await area.trigger('keydown', { key: 'ArrowDown' })
    await area.trigger('keydown', { key: 'Enter' })
    expect(wrapper.props('modelValue')).toBe('Vue')
    wrapper.unmount()
  })
})
