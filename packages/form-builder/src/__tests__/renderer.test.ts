import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { mount } from '@vue/test-utils'
import {
  defineFormField,
  DouFormRenderer,
  fieldNodes,
  findNode,
  getPath,
  rulesOf,
  setPath,
  toFormRule,
  useFormField,
} from '../index'
import type { FormDocument } from '../index'
import { spanStyle } from '../renderer/node-view'

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

describe('document helpers', () => {
  const sample = doc([
    { id: 'a', type: 'input', name: 'name' },
    {
      id: 's',
      type: 'section',
      children: [
        { id: 'b', type: 'input', name: 'contact.phone' },
        { id: 'c', type: 'divider' },
      ],
    },
  ])

  it('lists the nodes that hold a value, sections included', () => {
    expect(fieldNodes(sample).map((node) => node.id)).toEqual(['a', 'b'])
    expect(findNode(sample, 'c')?.type).toBe('divider')
    expect(findNode(sample, 'x')).toBeUndefined()
  })

  it('reads and writes dotted paths, creating objects on the way', () => {
    const model: Record<string, unknown> = {}
    setPath(model, 'contact.phone', '123')
    expect(model).toEqual({ contact: { phone: '123' } })
    expect(getPath(model, 'contact.phone')).toBe('123')
    expect(getPath(model, 'contact.mail.box')).toBeUndefined()
  })
})

describe('rules', () => {
  it('turns patterns into expressions and keeps the rest', () => {
    const rule = toFormRule({ pattern: '^\\d{6}$', message: '六位数字', trigger: 'blur' })
    expect(rule.pattern?.test('200001')).toBe(true)
    expect(rule.pattern?.test('20001')).toBe(false)
    expect(rule).toMatchObject({ message: '六位数字', trigger: 'blur' })
  })

  it('drops a pattern that does not compile, once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(toFormRule({ pattern: '(' }).pattern).toBeUndefined()
    expect(toFormRule({ pattern: '(' }).pattern).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('puts required first and caches per node', () => {
    const node = { id: 'a', type: 'input', name: 'a', required: true, rules: [{ min: 2 }] }
    const rules = rulesOf(node)
    expect(rules).toEqual([{ required: true }, { min: 2 }])
    expect(rulesOf(node)).toBe(rules)
    node.rules = [{ min: 3 }]
    expect(rulesOf(node)).toEqual([{ required: true }, { min: 3 }])
  })
})

describe('spans', () => {
  it('fills the row by default and clamps to the grid', () => {
    expect(spanStyle(undefined, 12)).toEqual({ '--dou-form-span': 12 })
    expect(spanStyle(20, 12)).toEqual({ '--dou-form-span': 12 })
    expect(spanStyle({ md: 6, lg: 4 }, 12)).toEqual({
      '--dou-form-span': 12,
      '--dou-form-span-md': 6,
      '--dou-form-span-lg': 4,
    })
  })
})

describe('DouFormRenderer', () => {
  it('fills in defaults and writes what is typed', async () => {
    const model = reactive<Record<string, any>>({ city: '上海' })
    const wrapper = mount(DouFormRenderer, {
      props: {
        model,
        form: doc([
          { id: 'n', type: 'input', name: 'name', label: '姓名' },
          { id: 'c', type: 'input', name: 'city', default: '北京' },
          { id: 't', type: 'checkbox-group', name: 'tags', default: ['a'] },
          { id: 'p', type: 'input', name: 'contact.phone' },
          { id: 'n2', type: 'input-number', name: 'age' },
          { id: 's', type: 'select', name: 'many', props: { multiple: true, options: ['a'] } },
        ]),
      },
    })
    expect(model).toEqual({
      name: '',
      city: '上海',
      tags: ['a'],
      contact: { phone: '' },
      age: null,
      many: [],
    })
    await wrapper.find('input').setValue('戴兜')
    expect(model.name).toBe('戴兜')
    expect(wrapper.find('label').text()).toBe('姓名')
  })

  it('gives each form its own copy of a default', () => {
    const sample = doc([{ id: 't', type: 'input-tag', name: 'tags', default: ['a'] }])
    const first = mount(DouFormRenderer, { props: { form: sample } })
    const second = mount(DouFormRenderer, { props: { form: sample } })
    const a = (first.vm as any).model.tags
    expect(a).toEqual(['a'])
    expect(a).not.toBe((second.vm as any).model.tags)
  })

  it('checks required fields and patterns on submit', async () => {
    const onInvalid = vi.fn<(errors: Record<string, string>) => void>()
    const wrapper = mount(DouFormRenderer, {
      props: {
        onInvalid,
        form: doc([
          { id: 'n', type: 'input', name: 'name', label: '姓名', required: true },
          {
            id: 'z',
            type: 'input',
            name: 'zip',
            rules: [{ pattern: '^\\d{6}$', message: '请输入六位邮编' }],
            default: '123',
          },
        ]),
      },
    })
    await wrapper.find('form').trigger('submit')
    await flush()
    expect(onInvalid).toHaveBeenCalledTimes(1)
    expect(Object.keys(onInvalid.mock.calls[0]![0])).toEqual(['name', 'zip'])
    expect(wrapper.text()).toContain('请输入六位邮编')
  })

  it('adds rules given in code to the document’s own', async () => {
    const wrapper = mount(DouFormRenderer, {
      props: {
        form: doc([{ id: 'n', type: 'input', name: 'name', default: 'x' }]),
        rules: { name: { validator: (value) => value === 'ok' || '不对' } },
      },
    })
    const result = await (wrapper.vm as any).validate()
    expect(result).toEqual({ valid: false, errors: { name: '不对' } })
  })

  it('resets to the starting values', async () => {
    const wrapper = mount(DouFormRenderer, {
      props: { form: doc([{ id: 'n', type: 'input', name: 'name', default: '戴兜' }]) },
    })
    await wrapper.find('input').setValue('阿青')
    expect((wrapper.vm as any).model.name).toBe('阿青')
    ;(wrapper.vm as any).resetFields()
    expect((wrapper.vm as any).model.name).toBe('戴兜')
  })

  it('renders sections with their own grid and display fields without a form item', () => {
    const wrapper = mount(DouFormRenderer, {
      props: {
        form: doc(
          [
            {
              id: 's',
              type: 'section',
              title: '联系方式',
              description: '只用于通知结果',
              bordered: true,
              columns: 2,
              span: { md: 6 },
              children: [
                { id: 'p', type: 'input', name: 'phone', span: 1 },
                { id: 'd', type: 'divider', props: { text: '或者' } },
                { id: 't', type: 'text', props: { content: '说明', variant: 'title' } },
              ],
            },
          ],
          { columns: 6 },
        ),
      },
    })
    const section = wrapper.find('.dou-form-renderer__section')
    expect(section.classes()).toContain('is-bordered')
    expect(section.attributes('role')).toBe('group')
    const title = wrapper.find('.dou-form-renderer__section-title')
    expect(section.attributes('aria-labelledby')).toBe(title.attributes('id'))
    const cells = wrapper.findAll('.dou-form-renderer__cell')
    expect(cells[0]!.attributes('style')).toContain('--dou-form-span: 6')
    expect(cells[0]!.attributes('style')).toContain('--dou-form-span-md: 6')
    expect(cells[1]!.attributes('style')).toContain('--dou-form-span: 1')
    expect(cells[2]!.attributes('style')).toContain('--dou-form-span: 2')
    expect(wrapper.findAll('.dou-form-item')).toHaveLength(1)
    expect(wrapper.find('.dou-divider').text()).toBe('或者')
    expect(wrapper.find('h3').text()).toBe('说明')
  })

  it('gives every field the label width in the horizontal layout', () => {
    const wrapper = mount(DouFormRenderer, {
      props: {
        form: doc([{ id: 'n', type: 'input', name: 'name', label: '姓名' }], {
          layout: 'horizontal',
          labelWidth: 120,
        }),
      },
    })
    expect(wrapper.find('form').classes()).toContain('dou-form-renderer--horizontal')
    expect(wrapper.find('.dou-form-item').attributes('style')).toContain('120px')
  })

  it('renders custom field types, which read their node', async () => {
    const Stars = defineComponent({
      props: { modelValue: Number, max: Number },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const field = useFormField()
        return () =>
          h(
            'button',
            {
              type: 'button',
              'data-name': field.node.name,
              onClick: () => emit('update:modelValue', props.max),
            },
            `${props.modelValue}/${props.max}`,
          )
      },
    })
    const stars = defineFormField<{ max: number }>({
      type: 'stars',
      component: Stars,
      defaultProps: { max: 5 },
      empty: () => 0,
    })
    const wrapper = mount(DouFormRenderer, {
      props: { fields: [stars], form: doc([{ id: 's', type: 'stars', name: 'score' }]) },
    })
    const button = wrapper.find('button')
    expect(button.text()).toBe('0/5')
    expect(button.attributes('data-name')).toBe('score')
    await button.trigger('click')
    expect(button.text()).toBe('5/5')
  })

  it('warns once about a type it does not know and renders the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(DouFormRenderer, {
      props: {
        form: doc([
          { id: 'a', type: 'nope', name: 'a' },
          { id: 'b', type: 'nope', name: 'b' },
          { id: 'c', type: 'input', name: 'c' },
        ]),
      },
    })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('input')).toHaveLength(1)
    warn.mockRestore()
  })

  it('re-renders only the field whose value changed', async () => {
    let renders = 0
    const Probe = defineComponent({
      props: { modelValue: String },
      setup(props) {
        return () => (renders++, h('span', props.modelValue))
      },
    })
    const probe = defineFormField({ type: 'probe', component: Probe, empty: () => '' })
    const nodes = Array.from({ length: 50 }, (_, index) => ({
      id: `n${index}`,
      type: 'probe',
      name: `f${index}`,
    }))
    const model = reactive<Record<string, string>>({})
    const sample = ref(doc(nodes))
    mount(DouFormRenderer, { props: { model, fields: [probe], form: sample.value } })
    expect(renders).toBe(50)
    model.f3 = 'x'
    await nextTick()
    expect(renders).toBe(51)
  })
})

describe('rules as data', () => {
  it.each([
    [{ required: true }, { required: true }],
    [
      { type: 'email', trigger: 'blur' },
      { type: 'email', trigger: 'blur' },
    ],
    [
      { min: 2, max: 8, message: 'x' },
      { min: 2, max: 8, message: 'x' },
    ],
    [{ pattern: 'ab', flags: 'gi' }, { pattern: /ab/i }],
  ] as const)('turns %j into a form rule', (spec, rule) => {
    expect(toFormRule({ ...spec })).toEqual(rule)
  })

  it.each([
    [{ required: undefined, rules: undefined }, []],
    [{ required: true, rules: [] }, [{ required: true }]],
    [
      { required: true, rules: [{ required: true, message: '必填' }] },
      [{ required: true, message: '必填' }],
    ],
    [{ required: false, rules: [{ max: 3 }] }, [{ max: 3 }]],
  ])('collects %j', (extra, rules) => {
    expect(rulesOf({ id: 'a', type: 'input', name: 'a', ...extra })).toEqual(rules)
  })

  it('leaves empty values to required: min alone lets an empty list through', async () => {
    const wrapper = mount(DouFormRenderer, {
      props: {
        form: doc([
          { id: 'a', type: 'checkbox-group', name: 'loose', rules: [{ min: 1 }] },
          {
            id: 'b',
            type: 'checkbox-group',
            name: 'strict',
            rules: [{ required: true, message: '至少选一项' }],
          },
        ]),
      },
    })
    const result = await (wrapper.vm as any).validate()
    expect(result).toEqual({ valid: false, errors: { strict: '至少选一项' } })
  })
})

describe('starting values', () => {
  it.each([
    ['the model wins over the node default', { name: '戴兜' }, { default: '阿青' }, '戴兜'],
    ['the node default fills a missing value', {}, { default: '阿青' }, '阿青'],
    ['null in the model is a value and stays', { name: null }, { default: '阿青' }, null],
    ['the type empty value comes last', {}, {}, ''],
  ])('%s', (_, start, node, expected) => {
    const model = reactive<Record<string, unknown>>({ ...start })
    mount(DouFormRenderer, {
      props: { model, form: doc([{ id: 'n', type: 'input', name: 'name', ...node }]) },
    })
    expect(model.name).toEqual(expected)
  })

  it.each([
    ['input-number', {}, null],
    ['select', { multiple: true }, []],
    ['select', {}, null],
    ['slider', { range: true, min: 10 }, [10, 100]],
    ['segmented-control', { options: [{ value: 'a' }, 'b'] }, 'a'],
    ['input-tag', {}, []],
    ['switch', {}, false],
  ])('a %s with %j starts at %j', (type, props, expected) => {
    const model = reactive<Record<string, unknown>>({})
    mount(DouFormRenderer, { props: { model, form: doc([{ id: 'n', type, name: 'v', props }]) } })
    expect(model.v).toEqual(expected)
  })

  it('writes nested paths into existing and missing objects', async () => {
    const model = reactive<Record<string, any>>({ contact: { phone: '1' }, other: 3 })
    const wrapper = mount(DouFormRenderer, {
      props: {
        model,
        form: doc([
          { id: 'a', type: 'input', name: 'contact.phone' },
          { id: 'b', type: 'input', name: 'contact.mail' },
          { id: 'c', type: 'input', name: 'address.city.name' },
        ]),
      },
    })
    expect(model).toEqual({
      contact: { phone: '1', mail: '' },
      other: 3,
      address: { city: { name: '' } },
    })
    await wrapper.findAll('input')[2]!.setValue('上海')
    expect(model.address.city.name).toBe('上海')
  })
})

describe('renderer events and checks', () => {
  it('emits change with the name and value of what was typed', async () => {
    const onChange = vi.fn<(name: string, value: unknown) => void>()
    const wrapper = mount(DouFormRenderer, {
      props: { onChange, form: doc([{ id: 'n', type: 'input', name: 'contact.name' }]) },
    })
    await wrapper.find('input').setValue('戴兜')
    expect(onChange).toHaveBeenLastCalledWith('contact.name', '戴兜')
    ;(wrapper.vm as any).resetFields()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('warns once about a version it does not know', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const form = { version: 2, nodes: [] } as unknown as FormDocument
    mount(DouFormRenderer, { props: { form } })
    mount(DouFormRenderer, { props: { form } })
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('takes the padding of bordered sections off the label column', () => {
    const wrapper = mount(DouFormRenderer, {
      props: {
        form: doc(
          [
            { id: 'a', type: 'input', name: 'a', label: '外面' },
            {
              id: 's',
              type: 'section',
              bordered: true,
              children: [
                { id: 'b', type: 'input', name: 'b', label: '里面' },
                {
                  id: 't',
                  type: 'section',
                  children: [{ id: 'c', type: 'input', name: 'c', label: '再里面' }],
                },
              ],
            },
          ],
          { layout: 'horizontal' },
        ),
      },
    })
    const widths = wrapper.findAll('.dou-form-item').map((item) => item.attributes('style'))
    expect(widths[0]).toContain('96px')
    expect(widths[1]).toContain('calc(96px - 1 * (var(--dou-space-lg) + 1px))')
    expect(widths[2]).toContain('calc(96px - 1 * (var(--dou-space-lg) + 1px))')
  })
})
