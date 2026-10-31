import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DouButton,
  DouCheckbox,
  DouCheckboxGroup,
  DouConfigProvider,
  DouForm,
  DouFormItem,
  DouInput,
  DouRadio,
  DouRadioGroup,
  DouSwitch,
  en,
} from '../../../index'
import type { CheckboxValue, FormInstance, FormProps, FormRules, RadioValue } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

function setup(initialProps: Partial<FormProps> = {}, rules: FormRules = {}) {
  const formProps = reactive(initialProps)
  const model = reactive({
    name: '',
    tags: [] as CheckboxValue[],
    plan: undefined as RadioValue | undefined,
    on: false,
  })
  const Root = defineComponent({
    setup() {
      return () =>
        h(DouForm, { ref: 'form', model, rules, ...formProps }, () => [
          h(DouFormItem, { label: '名称', prop: 'name', help: '项目的显示名称' }, () =>
            h(DouInput, {
              modelValue: model.name,
              'onUpdate:modelValue': (value: string) => (model.name = value),
            }),
          ),
          h(DouFormItem, { label: '标签', prop: 'tags' }, () =>
            h(
              DouCheckboxGroup,
              {
                modelValue: model.tags,
                'onUpdate:modelValue': (value: CheckboxValue[]) => (model.tags = value),
              },
              () => [h(DouCheckbox, { value: 'a' }, () => 'A'), h(DouCheckbox, { value: 'b' })],
            ),
          ),
          h(DouFormItem, { label: '方案', prop: 'plan' }, () =>
            h(
              DouRadioGroup,
              {
                modelValue: model.plan,
                'onUpdate:modelValue': (value: RadioValue | undefined) => (model.plan = value),
              },
              () => [h(DouRadio, { value: 'free' }), h(DouRadio, { value: 'pro' })],
            ),
          ),
          h(DouFormItem, { label: '启用', prop: 'on' }, () =>
            h(DouSwitch, {
              modelValue: model.on,
              'onUpdate:modelValue': (value: unknown) => (model.on = value as boolean),
            }),
          ),
          h(DouFormItem, null, () => h(DouButton, { nativeType: 'submit' }, () => '提交')),
        ])
    },
  })
  const wrapper = mount(Root, { attachTo: document.body })
  const form = wrapper.findComponent(DouForm)
  const items = wrapper.findAll('.dou-form-item')
  return { wrapper, model, form, formProps, items, vm: form.vm as unknown as FormInstance }
}

describe('DouForm', () => {
  it('ties each label to its control', () => {
    const { wrapper, items } = setup()
    const label = items[0]!.get('label')
    const input = items[0]!.get('input')
    expect(label.attributes('for')).toBe(input.attributes('id'))
    expect(input.attributes('aria-describedby')).toBe(items[0]!.get('[aria-live]').attributes('id'))

    const switchLabel = items[3]!.get('label')
    expect(switchLabel.attributes('for')).toBe(items[3]!.get('[role="switch"]').attributes('id'))
    wrapper.unmount()
  })

  it('labels groups with aria-labelledby instead of a for attribute', async () => {
    const { wrapper, items } = setup()
    await nextTick()
    for (const [item, role] of [
      [items[1]!, 'group'],
      [items[2]!, 'radiogroup'],
    ] as const) {
      const label = item.get('label')
      expect(label.attributes('for')).toBeUndefined()
      expect(item.get(`[role="${role}"]`).attributes('aria-labelledby')).toBe(
        label.attributes('id'),
      )
    }
    // Boxes inside a group do not take the item's id.
    expect(items[1]!.findAll('input').every((input) => !input.attributes('id'))).toBe(true)
    wrapper.unmount()
  })

  it('validates on submit and reports the errors', async () => {
    const { wrapper, form, items } = setup(
      {},
      { name: { required: true }, plan: { required: true, message: '请选择方案' } },
    )
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(form.emitted('submit')).toBeUndefined()
    expect(form.emitted('invalid')?.[0]).toEqual([{ name: '此项为必填项', plan: '请选择方案' }])
    expect(items[0]!.classes()).toContain('is-error')
    expect(items[0]!.get('.dou-form-item__error').text()).toBe('此项为必填项')
    // The error replaces the help text.
    expect(items[0]!.find('.dou-form-item__help').exists()).toBe(false)
    expect(items[0]!.get('input').attributes('aria-invalid')).toBe('true')
    expect(items[0]!.get('.dou-input').classes()).toContain('is-invalid')
    expect(items[2]!.get('[role="radiogroup"]').attributes('aria-invalid')).toBe('true')
    // The first invalid field takes focus.
    expect(document.activeElement).toBe(items[0]!.get('input').element)
    wrapper.unmount()
  })

  it('checks the whole model against the form schema', async () => {
    const { wrapper, form, items } = setup({
      schema: {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: (value) => {
            const model = value as { name: string; plan?: string }
            const issues = []
            if (!model.name) issues.push({ message: '请填写名称', path: ['name'] })
            if (!model.plan) issues.push({ message: '请选择方案', path: [{ key: 'plan' }] })
            return issues.length ? { issues } : { value }
          },
        },
      },
    })
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(form.emitted('invalid')?.[0]).toEqual([{ name: '请填写名称', plan: '请选择方案' }])
    expect(items[0]!.get('.dou-form-item__error').text()).toBe('请填写名称')
    expect(items[1]!.find('.dou-form-item__error').exists()).toBe(false)
    wrapper.unmount()
  })

  it('accepts schemas built as functions', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const callable = Object.assign(() => undefined, {
      '~standard': {
        version: 1 as const,
        vendor: 'test',
        validate: (value: unknown) => (value ? { value } : { issues: [{ message: '必填' }] }),
      },
    })
    const model = reactive({ name: '' })
    const wrapper = mount(() =>
      h(DouForm, { model, schema: callable }, () =>
        h(DouFormItem, { prop: 'name', rules: callable }, () => h(DouInput)),
      ),
    )
    const result = await (wrapper.findComponent(DouForm).vm as unknown as FormInstance).validate()
    expect(result.errors).toEqual({ name: '必填' })
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
    wrapper.unmount()
  })

  it('submits the model when every field passes', async () => {
    const { wrapper, form, model } = setup({}, { name: { required: true } })
    model.name = 'dou'
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(form.emitted('submit')?.[0]).toEqual([model])
    expect(form.emitted('invalid')).toBeUndefined()
    wrapper.unmount()
  })

  it('checks text on blur, then on every change once it shows an error', async () => {
    const { wrapper, items } = setup({}, { name: { required: true, min: 3 } })
    const input = items[0]!.get('input')

    await input.setValue('a')
    await flushPromises()
    expect(items[0]!.classes()).not.toContain('is-error')

    await input.trigger('blur')
    await flushPromises()
    expect(items[0]!.get('.dou-form-item__error').text()).toBe('至少需要 3 个字符')

    await input.setValue('abc')
    await flushPromises()
    expect(items[0]!.classes()).not.toContain('is-error')
    wrapper.unmount()
  })

  it('checks choices as soon as they change', async () => {
    const { wrapper, items } = setup({}, { tags: { type: 'array', max: 1 } })
    const boxes = items[1]!.findAll('input')
    await boxes[0]!.setValue(true)
    await flushPromises()
    expect(items[1]!.classes()).not.toContain('is-error')
    await boxes[1]!.setValue(true)
    await flushPromises()
    expect(items[1]!.get('.dou-form-item__error').text()).toBe('最多选择 1 项')
    wrapper.unmount()
  })

  it('resets fields to their initial values and clears errors', async () => {
    const { wrapper, model, vm, items } = setup({}, { name: { required: true } })
    model.name = ''
    model.tags = ['a']
    expect((await vm.validate()).valid).toBe(false)
    await flushPromises()
    vm.resetFields()
    await flushPromises()
    expect(model.tags).toEqual([])
    expect(items[0]!.classes()).not.toContain('is-error')
    wrapper.unmount()
  })

  it('validates and clears selected fields', async () => {
    const { wrapper, vm, items } = setup({}, { name: { required: true }, plan: { required: true } })
    const result = await vm.validate('plan')
    expect(result).toEqual({ valid: false, errors: { plan: '此项为必填项' } })
    await flushPromises()
    expect(items[0]!.classes()).not.toContain('is-error')
    vm.clearValidate(['plan'])
    await flushPromises()
    expect(items[2]!.classes()).not.toContain('is-error')
    wrapper.unmount()
  })

  it('keeps only the latest result of an async check', async () => {
    const resolvers: ((value: string | boolean) => void)[] = []
    const { wrapper, vm, items } = setup(
      {},
      { name: { validator: () => new Promise((resolve) => resolvers.push(resolve)) } },
    )
    const first = vm.validate()
    const second = vm.validate()
    resolvers[1]!(true)
    resolvers[0]!('旧的结果')
    await Promise.all([first, second])
    await flushPromises()
    expect(items[0]!.classes()).not.toContain('is-error')
    wrapper.unmount()
  })

  it('passes size and disabled down to the controls', () => {
    const { wrapper } = setup({ size: 'lg', disabled: true })
    expect(wrapper.get('.dou-input').classes()).toEqual(
      expect.arrayContaining(['dou-input--lg', 'is-disabled']),
    )
    expect(wrapper.get('.dou-checkbox').classes()).toContain('dou-checkbox--lg')
    expect(wrapper.get('.dou-radio').classes()).toContain('is-disabled')
    expect(wrapper.get('[role="switch"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.dou-button').classes()).toContain('dou-button--lg')
    wrapper.unmount()
  })

  it('marks required fields, or optional ones', async () => {
    const { wrapper, items, formProps } = setup({}, { name: { required: true } })
    expect(items[0]!.find('.dou-form-item__asterisk').exists()).toBe(true)
    expect(items[0]!.get('input').attributes('aria-required')).toBe('true')
    expect(items[1]!.find('.dou-form-item__asterisk').exists()).toBe(false)

    formProps.requiredMark = 'optional'
    await nextTick()
    expect(items[0]!.find('.dou-form-item__optional').exists()).toBe(false)
    expect(items[1]!.get('.dou-form-item__optional').text()).toBe('可选')
    wrapper.unmount()
  })

  it('applies layout, label alignment and label width', () => {
    const { wrapper } = setup({ layout: 'horizontal', labelAlign: 'end', labelWidth: 120 })
    const form = wrapper.get('form')
    expect(form.classes()).toEqual(
      expect.arrayContaining(['dou-form--horizontal', 'dou-form--label-end']),
    )
    expect(form.attributes('style')).toContain('--dou-form-label-width: 120px')
    expect(form.attributes('novalidate')).toBeDefined()
    wrapper.unmount()
  })
})

describe('DouFormItem', () => {
  it('shows a given error and a required mark from its own props', () => {
    const wrapper = mount(DouFormItem, {
      props: { label: '域名', required: true, error: '已被占用' },
      slots: { default: () => h(DouInput) },
    })
    expect(wrapper.find('.dou-form-item__asterisk').exists()).toBe(true)
    expect(wrapper.get('.dou-form-item__error').text()).toBe('已被占用')
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
  })

  it('reads the optional mark from the locale', () => {
    const wrapper = mount(DouConfigProvider, {
      props: { locale: en },
      slots: {
        default: () =>
          h(DouForm, { requiredMark: 'optional' }, () => h(DouFormItem, { label: 'Nickname' })),
      },
    })
    expect(wrapper.get('.dou-form-item__optional').text()).toBe('optional')
  })

  it('lets a standalone checkbox take the label', () => {
    const wrapper = mount(DouFormItem, {
      props: { label: '协议' },
      slots: { default: () => h(DouCheckbox, null, () => '同意') },
    })
    expect(wrapper.get('label.dou-form-item__label').attributes('for')).toBe(
      wrapper.get('input').attributes('id'),
    )
  })

  it('keeps errors with their rows when a row is removed', async () => {
    let id = 3
    const model = reactive({
      contacts: [
        { id: 1, name: '' },
        { id: 2, name: '戴兜' },
        { id: 3, name: '' },
      ],
    })
    const Root = defineComponent({
      setup() {
        return () =>
          h(DouForm, { ref: 'form', model, rules: { contacts: { required: true } } }, () => [
            ...model.contacts.map((contact, index) =>
              h(
                DouFormItem,
                { key: contact.id, prop: `contacts.${index}.name`, required: true },
                () =>
                  h(DouInput, {
                    modelValue: contact.name,
                    'onUpdate:modelValue': (value: string) => (contact.name = value),
                  }),
              ),
            ),
            h(DouFormItem, { prop: 'contacts' }),
          ])
      },
    })
    const wrapper = mount(Root, { attachTo: document.body })
    const form = wrapper.vm.$refs.form as FormInstance
    const { errors } = await form.validate()
    expect(Object.keys(errors)).toEqual(['contacts.0.name', 'contacts.2.name'])

    model.contacts.splice(0, 1)
    await flushPromises()
    const items = wrapper.findAll('.dou-form-item')
    expect(items.map((item) => item.classes().includes('is-error'))).toEqual([false, true, false])

    // the list's own error clears as soon as a row is added back
    model.contacts.splice(0)
    await form.validate('contacts')
    await flushPromises()
    expect(wrapper.find('.dou-form-item.is-error').exists()).toBe(true)
    model.contacts.push({ id: ++id, name: 'x' })
    await flushPromises()
    expect(wrapper.findAll('.dou-form-item.is-error')).toHaveLength(0)
  })
})
