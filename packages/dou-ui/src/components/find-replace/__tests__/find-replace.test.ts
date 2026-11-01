import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { DouFindReplace } from '../index'

describe('DouFindReplace', () => {
  it('shows the count and where the current match is', async () => {
    const wrapper = mount(DouFindReplace, { props: { search: '', count: 0 } })
    const status = () => wrapper.find('.dou-find-replace__status').text()
    expect(status()).toBe('')
    await wrapper.setProps({ search: '上海', count: 0 })
    expect(status()).toBe('无结果')
    await wrapper.setProps({ count: 3 })
    expect(status()).toBe('共 3 个')
    await wrapper.setProps({ current: 1 })
    expect(status()).toBe('2/3')
    await wrapper.setProps({ capped: true })
    expect(status()).toBe('超过 3 个')
    await wrapper.setProps({ error: '正则表达式有误' })
    expect(status()).toBe('正则表达式有误')
    expect(wrapper.find('.dou-find-replace__field').classes()).toContain('is-invalid')
  })

  it('turns keys into events', async () => {
    const wrapper = mount(DouFindReplace, {
      props: { search: 'a', count: 2, replacing: true },
      attachTo: document.body,
    })
    const [find, replace] = wrapper.findAll('.dou-find-replace__input')
    await find!.trigger('keydown', { key: 'Enter' })
    await find!.trigger('keydown', { key: 'Enter', shiftKey: true })
    await replace!.trigger('keydown', { key: 'Enter' })
    await replace!.trigger('keydown', { key: 'Enter', ctrlKey: true })
    await wrapper.trigger('keydown', { key: 'Escape' })
    expect(Object.keys(wrapper.emitted())).toEqual(
      expect.arrayContaining(['next', 'previous', 'replaceOne', 'replaceAll', 'close']),
    )
    await find!.setValue('b')
    expect(wrapper.emitted('update:search')![0]).toEqual(['b'])
    wrapper.unmount()
  })

  it('opens the replace box with Ctrl+H, and has none when read-only', async () => {
    const wrapper = mount(DouFindReplace, { props: { search: 'a' }, attachTo: document.body })
    expect(wrapper.findAll('.dou-find-replace__input').length).toBe(1)
    await wrapper.trigger('keydown', { key: 'h', ctrlKey: true })
    expect(wrapper.emitted('update:replacing')![0]).toEqual([true])
    await wrapper.setProps({ replacing: true, readonly: true })
    await nextTick()
    expect(wrapper.findAll('.dou-find-replace__input').length).toBe(1)
    expect(wrapper.find('.dou-find-replace__expand').exists()).toBe(false)
    wrapper.unmount()
  })
})
