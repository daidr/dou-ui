import { describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { checkDocumentShape, defineFormField, DouFormRenderer, toFormRule } from '../index'
import type { FormDocument, FormValidator } from '../index'

const doc = (nodes: FormDocument['nodes'], extra: Partial<FormDocument> = {}): FormDocument => ({
  version: 1,
  nodes,
  ...extra,
})

const flush = async () => {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve))
  await nextTick()
}

const values = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('.dou-form-renderer__value').map((el) => el.text())

describe('validators', () => {
  it('runs a validator named by a rule, with the values, item and path', async () => {
    const taken = vi.fn<FormValidator>(async (value) =>
      value === 'admin' ? '用户名已被占用' : true,
    )
    const wrapper = mount(DouFormRenderer, {
      props: {
        form: doc([{ id: 'u', type: 'input', name: 'username', rules: [{ validator: 'taken' }] }]),
        validators: { taken },
        model: { username: 'admin' },
      },
    })
    const result = await (wrapper.vm as any).validate()
    expect(result).toEqual({ valid: false, errors: { username: '用户名已被占用' } })
    expect(taken).toHaveBeenCalledWith('admin', {
      values: { username: 'admin' },
      item: null,
      path: 'username',
    })
    await flush()
    expect(wrapper.text()).toContain('用户名已被占用')
  })

  it('hands a validator inside a list its item and full path', async () => {
    const seen: unknown[] = []
    const phone: FormValidator = (value, context) => {
      seen.push([context.path, context.item])
      return value !== '000' || false
    }
    const model = reactive({ guests: [{ phone: '123' }, { phone: '000' }] })
    const wrapper = mount(DouFormRenderer, {
      props: {
        form: doc([
          {
            id: 'g',
            type: 'list',
            name: 'guests',
            children: [
              {
                id: 'p',
                type: 'input',
                name: 'phone',
                rules: [{ validator: 'phone', message: '号码不对' }],
              },
            ],
          },
        ]),
        validators: { phone },
        model,
      },
    })
    await flush()
    const result = await (wrapper.vm as any).validate()
    expect(result.errors).toEqual({ 'guests.1.phone': '号码不对' })
    expect(seen).toContainEqual(['guests.0.phone', model.guests[0]])
    expect(seen).toContainEqual(['guests.1.phone', model.guests[1]])
  })

  it('skips an empty value and warns once about a validator nobody gave', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rule = toFormRule({ validator: 'missing-one' })
    expect(await rule.validator!('', {})).toBe(true)
    expect(await rule.validator!('x', {})).toBe(true)
    expect(await rule.validator!('y', {})).toBe(true)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('accepts validator in a document’s rules', () => {
    expect(
      checkDocumentShape(
        doc([{ id: 'a', type: 'input', name: 'a', rules: [{ validator: 'taken' }] }]),
      ),
    ).toEqual([])
    expect(
      checkDocumentShape(
        doc([{ id: 'a', type: 'input', name: 'a', rules: [{ validator: 1 as any }] }]),
      ),
    ).toHaveLength(1)
  })
})

describe('setErrors', () => {
  it('shows errors by path and marks the tab that holds them', async () => {
    const wrapper = mount(DouFormRenderer, {
      attachTo: document.body,
      props: {
        form: doc([
          {
            id: 't',
            type: 'tabs',
            children: [
              {
                id: 'p1',
                type: 'page',
                title: '基本',
                children: [{ id: 'a', type: 'input', name: 'name' }],
              },
              {
                id: 'p2',
                type: 'page',
                title: '域名',
                children: [{ id: 'b', type: 'input', name: 'domain' }],
              },
            ],
          },
        ]),
        model: { name: 'x', domain: 'douui' },
      },
    })
    await flush()
    ;(wrapper.vm as any).setErrors({ domain: '这个域名已被占用' })
    await flush()
    expect(wrapper.text()).toContain('这个域名已被占用')
    expect(wrapper.findAll('.dou-form-renderer__tab-error')).toHaveLength(1)
    ;(wrapper.vm as any).setErrors({ domain: '' })
    await flush()
    expect(wrapper.findAll('.dou-form-renderer__tab-error')).toHaveLength(0)
    wrapper.unmount()
  })
})

describe('readonly', () => {
  it('shows each value as text, with labels for options and no default filled in', async () => {
    const model: Record<string, unknown> = {
      name: '戴兜',
      password: 'secret',
      city: 'sh',
      tags: ['a', 'c'],
      agree: true,
      on: false,
      start: '2026-11-01',
      span: ['2026-11-01', '2026-11-03'],
      quarter: '2026-Q4',
      area: ['zj', 'hz'],
      price: 3,
      volume: [20, 80],
      at: '09:30',
    }
    const wrapper = mount(DouFormRenderer, {
      props: {
        readonly: true,
        model,
        form: doc([
          { id: 'a', type: 'input', name: 'name', label: '姓名', help: '真实姓名', required: true },
          { id: 'b', type: 'input', name: 'password', props: { type: 'password' } },
          {
            id: 'c',
            type: 'select',
            name: 'city',
            props: { options: [{ value: 'sh', label: '上海' }, 'bj'] },
          },
          {
            id: 'd',
            type: 'checkbox-group',
            name: 'tags',
            props: {
              options: [
                { value: 'a', label: '甲' },
                { value: 'b', label: '乙' },
                { value: 'c', label: '丙' },
              ],
            },
          },
          { id: 'e', type: 'checkbox', name: 'agree' },
          { id: 'f', type: 'switch', name: 'on' },
          { id: 'g', type: 'date-picker', name: 'start' },
          { id: 'h', type: 'date-picker', name: 'span', props: { range: true } },
          { id: 'i', type: 'date-picker', name: 'quarter', props: { type: 'quarter' } },
          {
            id: 'j',
            type: 'cascader',
            name: 'area',
            props: {
              options: [{ value: 'zj', label: '浙江', children: [{ value: 'hz', label: '杭州' }] }],
            },
          },
          { id: 'k', type: 'input-number', name: 'price', props: { precision: 2 } },
          { id: 'l', type: 'slider', name: 'volume', props: { range: true } },
          { id: 'm', type: 'time-picker', name: 'at' },
          { id: 'n', type: 'textarea', name: 'note' },
        ]),
      },
    })
    await flush()
    expect(values(wrapper)).toEqual([
      '戴兜',
      '••••••',
      '上海',
      '甲、丙',
      '是',
      '否',
      '2026-11-01',
      '2026-11-01 ~ 2026-11-03',
      '2026 年第 4 季度',
      '浙江 / 杭州',
      '3.00',
      '20 – 80',
      '09:30',
      '—',
    ])
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('真实姓名')
    expect(wrapper.find('.dou-form-item__asterisk').exists()).toBe(false)
    // Nothing is written: the empty note stays missing.
    expect('note' in model).toBe(false)
  })

  it('works out formulas without writing them', async () => {
    const model: Record<string, unknown> = { price: 4, count: 3 }
    const wrapper = mount(DouFormRenderer, {
      props: {
        readonly: true,
        model,
        form: doc([
          { id: 'a', type: 'input-number', name: 'price' },
          { id: 'b', type: 'input-number', name: 'count' },
          {
            id: 'c',
            type: 'input-number',
            name: 'total',
            formula: 'values.price * values.count',
          },
        ]),
      },
    })
    await flush()
    expect(values(wrapper)).toEqual(['4', '3', '12'])
    expect('total' in model).toBe(false)
  })

  it('shows list items without buttons and every step', async () => {
    const wrapper = mount(DouFormRenderer, {
      props: {
        readonly: true,
        model: { guests: [{ name: '戴兜' }, { name: '小明' }], plan: 'a' },
        form: doc([
          {
            id: 'l',
            type: 'list',
            name: 'guests',
            label: '同行人',
            children: [{ id: 'n', type: 'input', name: 'name' }],
          },
          {
            id: 's',
            type: 'steps',
            children: [
              {
                id: 'p1',
                type: 'page',
                title: '第一步',
                children: [{ id: 'x', type: 'input', name: 'plan' }],
              },
              {
                id: 'p2',
                type: 'page',
                title: '第二步',
                children: [{ id: 'y', type: 'input', name: 'more' }],
              },
            ],
          },
        ]),
      },
    })
    await flush()
    expect(values(wrapper)).toEqual(['戴兜', '小明', 'a', '—'])
    expect(wrapper.find('.dou-form-renderer__list-add').exists()).toBe(false)
    expect(wrapper.find('.dou-form-renderer__list-remove').exists()).toBe(false)
    expect(wrapper.find('.dou-sortable-handle, .dou-form-renderer__list-handle').exists()).toBe(
      false,
    )
    expect(wrapper.find('.dou-steps').exists()).toBe(false)
    expect(wrapper.text()).toContain('第一步')
    expect(wrapper.text()).toContain('第二步')
  })

  it('uses a type’s own format or component', async () => {
    const money = defineFormField({
      type: 'money',
      component: { render: () => null },
      format: (value) => `¥${String(value)}`,
    })
    const wrapper = mount(DouFormRenderer, {
      props: {
        readonly: true,
        fields: [money],
        model: { fee: 12, color: '#336699', rate: 4 },
        form: doc([
          { id: 'a', type: 'money', name: 'fee' },
          { id: 'b', type: 'color-picker', name: 'color' },
          { id: 'c', type: 'rate', name: 'rate' },
        ]),
      },
    })
    await flush()
    expect(values(wrapper)).toEqual(['¥12'])
    expect(wrapper.find('.dou-form-renderer__color').text()).toBe('#336699')
    expect(wrapper.find('.dou-rate').exists()).toBe(true)
  })

  it('fills in defaults once it is switched to editing', async () => {
    const model: Record<string, unknown> = {}
    const wrapper = mount(DouFormRenderer, {
      props: {
        readonly: true,
        model,
        form: doc([{ id: 'a', type: 'input', name: 'name', default: '新名字' }]),
      },
    })
    await flush()
    expect(model.name).toBeUndefined()
    await wrapper.setProps({ readonly: false })
    await flush()
    expect(model.name).toBe('新名字')
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('新名字')
  })
})
