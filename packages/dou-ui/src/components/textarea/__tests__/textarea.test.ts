import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { DouForm, DouFormItem, DouTextarea } from '../../../index'

describe('DouTextarea', () => {
  it('renders a native textarea with defaults', () => {
    const wrapper = mount(DouTextarea)
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['dou-textarea', 'dou-textarea--md']))
    const textarea = wrapper.get('textarea')
    expect(textarea.attributes('rows')).toBe('3')
    expect(textarea.attributes('style')).toContain('resize: vertical')
  })

  it('works with v-model', async () => {
    const wrapper = mount(DouTextarea, {
      props: {
        modelValue: 'a',
        'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
      },
    })
    await wrapper.get('textarea').setValue('第一行\n第二行')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['第一行\n第二行'])
  })

  it('forwards attributes to the native textarea and dresses the field with class', () => {
    const wrapper = mount(DouTextarea, {
      attrs: { placeholder: '简介', name: 'bio', class: 'extra', style: 'width: 300px' },
    })
    const textarea = wrapper.get('textarea')
    expect(textarea.attributes('placeholder')).toBe('简介')
    expect(textarea.attributes('name')).toBe('bio')
    expect(wrapper.classes()).toContain('extra')
    expect(wrapper.attributes('style')).toContain('width: 300px')
  })

  it('reflects disabled, readonly and invalid', () => {
    const wrapper = mount(DouTextarea, { props: { disabled: true, readonly: true, invalid: true } })
    const textarea = wrapper.get('textarea')
    expect(textarea.attributes('disabled')).toBeDefined()
    expect(textarea.attributes('readonly')).toBeDefined()
    expect(textarea.attributes('aria-invalid')).toBe('true')
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['is-disabled', 'is-readonly', 'is-invalid']),
    )
  })

  it('counts characters, with the limit when there is one', async () => {
    const wrapper = mount(DouTextarea, { props: { showCount: true, modelValue: '你好👋' } })
    expect(wrapper.get('.dou-textarea__count').text()).toBe('3')
    await wrapper.setProps({ modelValue: 'abc' })
    expect(wrapper.get('.dou-textarea__count').text()).toBe('3')
    const limited = mount(DouTextarea, {
      props: { showCount: true, modelValue: 'abc' },
      attrs: { maxlength: 100 },
    })
    expect(limited.get('.dou-textarea__count').text()).toBe('3 / 100')
    expect(limited.get('textarea').attributes('maxlength')).toBe('100')
  })

  it('grows with the content between the given rows', async () => {
    const wrapper = mount(DouTextarea, {
      props: { autosize: { minRows: 2, maxRows: 4 }, modelValue: '' },
      attachTo: document.body,
    })
    const textarea = wrapper.get('textarea').element
    textarea.style.lineHeight = '20px'
    textarea.style.padding = '5px 12px'

    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, get: () => 30 })
    wrapper.vm.resizeToContent()
    // below the least rows: 2 × 20 + 10
    expect(textarea.style.height).toBe('50px')

    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, get: () => 70 })
    wrapper.vm.resizeToContent()
    expect(textarea.style.height).toBe('70px')
    expect(textarea.style.overflowY).toBe('hidden')

    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, get: () => 200 })
    wrapper.vm.resizeToContent()
    // above the most rows: 4 × 20 + 10, and it scrolls from there
    expect(textarea.style.height).toBe('90px')
    expect(textarea.style.overflowY).toBe('auto')
    expect(wrapper.get('textarea').attributes('style')).toContain('resize: none')
    // the rows go to the styles too, for browsers that size the field themselves
    expect(wrapper.get('textarea').attributes('style')).toContain('--dou-textarea-max-rows: 4')
    wrapper.unmount()
  })

  it('fits the fields that mount together in one pass, reading their layout once', async () => {
    // a browser that can not size fields by their content
    vi.stubGlobal('CSS', { supports: () => false })
    let reads = 0
    const proto = HTMLTextAreaElement.prototype
    const before = Object.getOwnPropertyDescriptor(proto, 'scrollHeight')
    let collapsed = 0
    Object.defineProperty(proto, 'scrollHeight', {
      configurable: true,
      get(this: HTMLTextAreaElement) {
        reads++
        // every field collapses before the first is read
        if (this.style.height === 'auto') collapsed++
        return 70
      },
    })
    const wrapper = mount(
      { render: () => [1, 2, 3].map(() => h(DouTextarea, { autosize: true, rows: 1 })) },
      { attachTo: document.body },
    )
    await nextTick()
    await Promise.resolve()
    expect(reads).toBe(3)
    expect(collapsed).toBe(3)
    for (const textarea of wrapper.findAll('textarea'))
      expect(textarea.element.style.height).toBe('70px')
    wrapper.unmount()
    if (before) Object.defineProperty(proto, 'scrollHeight', before)
    else delete (proto as any).scrollHeight
    vi.unstubAllGlobals()
  })

  it('takes its id and description from a form item', () => {
    const wrapper = mount(DouForm, {
      slots: {
        default: () =>
          h(DouFormItem, { label: '简介', help: '最多 200 字', required: true }, () =>
            h(DouTextarea),
          ),
      },
    })
    const textarea = wrapper.get('textarea')
    expect(wrapper.get('label').attributes('for')).toBe(textarea.attributes('id'))
    expect(textarea.attributes('aria-describedby')).toBeDefined()
    expect(textarea.attributes('aria-required')).toBe('true')
  })

  it('follows the form size and disabled state', () => {
    const wrapper = mount(DouForm, {
      props: { size: 'lg', disabled: true },
      slots: { default: () => h(DouFormItem, () => h(DouTextarea)) },
    })
    expect(wrapper.get('.dou-textarea').classes()).toContain('dou-textarea--lg')
    expect(wrapper.get('textarea').attributes('disabled')).toBeDefined()
  })
})
