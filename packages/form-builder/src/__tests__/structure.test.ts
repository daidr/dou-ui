import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { DouConfigProvider, en } from 'dou-ui'
import {
  checkDocument,
  DouFormRenderer,
  evaluateExpression,
  findItemFormulaCycles,
  migrateDocument,
  useFormBuilderMessages,
  visibleValues,
} from '../index'
import type { FormDocument, FormListNode } from '../index'

const doc = (nodes: FormDocument['nodes']): FormDocument => ({ version: 1, nodes })

const flush = async () => {
  for (let round = 0; round < 3; round++) {
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve))
  }
  await nextTick()
}

const guests: FormListNode = {
  id: 'g',
  type: 'list',
  name: 'guests',
  label: '同行人',
  min: 1,
  max: 3,
  children: [
    { id: 'gn', type: 'input', name: 'name', label: '姓名', required: true },
    { id: 'gp', type: 'input-number', name: 'price', label: '单价', default: 100 },
    { id: 'gq', type: 'input-number', name: 'count', label: '数量', default: 1 },
    {
      id: 'gt',
      type: 'input-number',
      name: 'total',
      label: '小计',
      formula: 'item.price * item.count',
    },
  ],
}

describe('expressions in lists', () => {
  it('reads the item and sums one key of every item', () => {
    expect(evaluateExpression('item.price * 2', { item: { price: 3 } })).toBe(6)
    const values = { items: [{ amount: 1.1 }, { amount: 2.2 }, { amount: null }] }
    expect(evaluateExpression("sum(values.items, 'amount')", { values })).toBe(3.3)
    expect(evaluateExpression("max(values.items, 'amount')", { values })).toBe(2.2)
  })

  it('finds item formulas that read each other', () => {
    const list: FormListNode = {
      id: 'l',
      type: 'list',
      name: 'rows',
      children: [
        { id: 'a', type: 'input-number', name: 'a', formula: 'item.b + 1' },
        { id: 'b', type: 'input-number', name: 'b', formula: 'item.a + 1' },
        { id: 'c', type: 'input-number', name: 'c', formula: 'item.a' },
      ],
    }
    expect(findItemFormulaCycles(list).map((cycle) => new Set(cycle))).toEqual([
      new Set(['a', 'b']),
    ])
  })
})

describe('lists', () => {
  it('starts with min items, adds, removes and keeps to the bounds', async () => {
    const model = reactive<Record<string, any>>({})
    const wrapper = mount(DouFormRenderer, { props: { model, form: doc([guests]) } })
    expect(model.guests).toEqual([{ name: '', price: 100, count: 1, total: 100 }])
    const add = () => wrapper.find('.dou-form-renderer__list-footer button')
    const removes = () => wrapper.findAll('.dou-form-renderer__list-remove')
    expect(removes()[0]!.attributes('disabled')).toBeDefined()

    await add().trigger('click')
    await add().trigger('click')
    expect(model.guests).toHaveLength(3)
    expect(add().attributes('disabled')).toBeDefined()
    expect(removes()[1]!.attributes('aria-label')).toBe('删除第 2 项')

    await wrapper.findAll('.dou-form-renderer__list-item input')[0]!.setValue('戴兜')
    expect(model.guests[0].name).toBe('戴兜')
    await removes()[0]!.trigger('click')
    expect(model.guests).toHaveLength(2)
    expect(model.guests[0].name).toBe('')
  })

  it('moves focus to the new item, the next one after removing, and the add button at last', async () => {
    const wrapper = mount(DouFormRenderer, {
      attachTo: document.body,
      props: { form: doc([{ ...guests, min: 0 }]) },
    })
    const add = wrapper.find('.dou-form-renderer__list-add')
    await add.trigger('click')
    await add.trigger('click')
    await nextTick()
    const inputs = () => wrapper.findAll('.dou-form-renderer__list-item input')
    expect(document.activeElement).toBe(
      wrapper.findAll('.dou-form-renderer__list-item')[1]!.find('input').element,
    )
    await wrapper.findAll('.dou-form-renderer__list-remove')[0]!.trigger('click')
    await nextTick()
    expect(document.activeElement).toBe(inputs()[0]!.element)
    await wrapper.findAll('.dou-form-renderer__list-remove')[0]!.trigger('click')
    await nextTick()
    expect(document.activeElement).toBe(wrapper.find('.dou-form-renderer__list-add').element)
    wrapper.unmount()
  })

  it('works out item formulas per item and totals across items', async () => {
    const model = reactive<Record<string, any>>({
      guests: [
        { name: '戴兜', price: 100, count: 2 },
        { name: '阿青', price: 80, count: 1 },
      ],
    })
    mount(DouFormRenderer, {
      props: {
        model,
        form: doc([
          guests,
          { id: 'sum', type: 'input-number', name: 'sum', formula: "sum(values.guests, 'total')" },
        ]),
      },
    })
    expect(model.guests.map((row: any) => row.total)).toEqual([200, 80])
    expect(model.sum).toBe(280)
    model.guests[1].count = 3
    await nextTick()
    expect(model.guests[1].total).toBe(240)
    expect(model.sum).toBe(440)
  })

  it('checks the fields of every item and shows and hides by item', async () => {
    const onInvalid = vi.fn<(errors: Record<string, string>) => void>()
    const model = reactive<Record<string, any>>({
      guests: [
        { name: '戴兜', child: true },
        { name: '', child: false },
      ],
    })
    const wrapper = mount(DouFormRenderer, {
      props: {
        model,
        onInvalid,
        form: doc([
          {
            ...guests,
            children: [
              guests.children[0]!,
              { id: 'c', type: 'switch', name: 'child' },
              {
                id: 'age',
                type: 'input-number',
                name: 'age',
                label: '年龄',
                visibleWhen: 'item.child',
              },
            ],
          },
        ]),
      },
    })
    expect(wrapper.findAll('.dou-form-renderer__list-item')[0]!.text()).toContain('年龄')
    expect(wrapper.findAll('.dou-form-renderer__list-item')[1]!.text()).not.toContain('年龄')
    await wrapper.find('form').trigger('submit')
    await flush()
    expect(Object.keys(onInvalid.mock.calls[0]![0])).toEqual(['guests.1.name'])
  })

  it('puts the items back on reset', async () => {
    const wrapper = mount(DouFormRenderer, {
      props: { form: doc([{ ...guests, default: [{ name: '戴兜' }] }]) },
    })
    const vm = wrapper.vm as any
    await wrapper.find('.dou-form-renderer__list-footer button').trigger('click')
    await wrapper.find('.dou-form-renderer__list-item input').setValue('阿青')
    vm.resetFields()
    await nextTick()
    expect(vm.model.guests).toHaveLength(1)
    expect(vm.model.guests[0].name).toBe('戴兜')
  })
})

const steps = doc([
  {
    id: 's',
    type: 'steps',
    children: [
      {
        id: 'p1',
        type: 'page',
        title: '联系人',
        children: [{ id: 'n', type: 'input', name: 'name', label: '姓名', required: true }],
      },
      {
        id: 'p2',
        type: 'page',
        title: '地址',
        children: [{ id: 'c', type: 'input', name: 'city', label: '城市', required: true }],
      },
    ],
  },
])

describe('steps', () => {
  it('checks each step before the next one and shows the slot on the last', async () => {
    const wrapper = mount(DouFormRenderer, {
      props: { form: steps },
      slots: { default: '<button type="submit" class="go">提交</button>' },
    })
    const shown = () =>
      wrapper
        .findAll('.dou-form-renderer__step')
        .findIndex((step) => step.attributes('hidden') === undefined)
    expect(shown()).toBe(0)
    expect(wrapper.find('.go').exists()).toBe(false)

    const next = () => wrapper.findAll('.dou-form-renderer__steps-footer button').at(-1)!
    await next().trigger('click')
    await flush()
    expect(shown()).toBe(0)
    expect(wrapper.find('.dou-steps__item.is-error, .is-error').exists()).toBe(true)

    await wrapper.find('input').setValue('戴兜')
    await flush()
    await next().trigger('click')
    await flush()
    expect(shown()).toBe(1)
    expect(wrapper.find('.dou-form-renderer__steps-footer .go').exists()).toBe(true)
    expect(wrapper.find('.dou-form-renderer__steps-footer').text()).toContain('上一步')
  })

  it('opens the step of the first error on submit', async () => {
    const wrapper = mount(DouFormRenderer, { props: { form: steps } })
    const vm = wrapper.vm as any
    vm.model.name = '戴兜'
    await nextTick()
    const next = wrapper.findAll('.dou-form-renderer__steps-footer button').at(-1)!
    await next.trigger('click')
    await flush()
    vm.model.name = ''
    await wrapper.find('form').trigger('submit')
    await flush()
    const shown = wrapper
      .findAll('.dou-form-renderer__step')
      .findIndex((step) => step.attributes('hidden') === undefined)
    expect(shown).toBe(0)
  })
})

describe('tabs', () => {
  it('checks the fields of every tab and switches to the first error', async () => {
    const onInvalid = vi.fn<(errors: Record<string, string>) => void>()
    const wrapper = mount(DouFormRenderer, {
      attachTo: document.body,
      props: {
        onInvalid,
        form: doc([
          {
            id: 't',
            type: 'tabs',
            children: [
              {
                id: 'a',
                type: 'page',
                title: '基本',
                children: [{ id: 'n', type: 'input', name: 'name', default: '戴兜' }],
              },
              {
                id: 'b',
                type: 'page',
                title: '更多',
                children: [{ id: 'c', type: 'input', name: 'city', required: true }],
              },
            ],
          },
        ]),
      },
    })
    await flush()
    expect(wrapper.findAll('[role=tab]').map((tab) => tab.text())).toEqual(['基本', '更多'])
    expect(wrapper.findAll('input')).toHaveLength(2)
    await wrapper.find('form').trigger('submit')
    await flush()
    expect(Object.keys(onInvalid.mock.calls[0]![0])).toEqual(['city'])
    expect(wrapper.findAll('[role=tab]')[1]!.attributes('aria-selected')).toBe('true')
    expect(wrapper.findAll('[role=tab]')[1]!.find('.dou-form-renderer__tab-error').exists()).toBe(
      true,
    )
    expect(wrapper.findAll('[role=tab]')[1]!.text()).toContain('有错误')
    expect(wrapper.findAll('[role=tab]')[0]!.find('.dou-form-renderer__tab-error').exists()).toBe(
      false,
    )
    wrapper.unmount()
  })
})

describe('hidden values', () => {
  const form = doc([
    {
      id: 'k',
      type: 'radio-group',
      name: 'kind',
      default: 'laptop',
      props: { options: ['laptop', 'screen'] },
    },
    { id: 'os', type: 'input', name: 'os', visibleWhen: "values.kind == 'laptop'" },
    {
      id: 'g',
      type: 'list',
      name: 'parts',
      children: [
        { id: 'pn', type: 'input', name: 'name' },
        { id: 'pc', type: 'input', name: 'note', visibleWhen: "item.name == 'x'" },
      ],
    },
  ])

  it('leaves out hidden fields, item by item', () => {
    const model = {
      kind: 'screen',
      os: 'Linux',
      parts: [
        { name: 'x', note: 'a' },
        { name: 'y', note: 'b' },
      ],
    }
    expect(visibleValues(form, model)).toEqual({
      kind: 'screen',
      parts: [{ name: 'x', note: 'a' }, { name: 'y' }],
    })
    expect(model.os).toBe('Linux')
  })

  it('submits without them unless keepHidden is set', async () => {
    const onSubmit = vi.fn<(values: Record<string, unknown>) => void>()
    const model = reactive<Record<string, any>>({ os: 'Linux' })
    const wrapper = mount(DouFormRenderer, { props: { form, model, onSubmit } })
    model.kind = 'screen'
    await wrapper.find('form').trigger('submit')
    await flush()
    expect(onSubmit.mock.calls[0]![0]).toEqual({ kind: 'screen', parts: [] })
    expect(onSubmit.mock.calls[0]![0]).not.toBe(model)

    await wrapper.setProps({ keepHidden: true })
    await wrapper.find('form').trigger('submit')
    await flush()
    expect(onSubmit.mock.calls[1]![0]).toEqual({ kind: 'screen', os: 'Linux', parts: [] })
    expect((wrapper.vm as any).getValues()).toEqual({ kind: 'screen', os: 'Linux', parts: [] })
  })
})

describe('checkDocument', () => {
  it('finds what is wrong with a document', () => {
    const problems = checkDocument(
      doc([
        { id: 'a', type: 'input', name: 'name' },
        { id: 'a', type: 'input', name: 'name' },
        { id: 'b', type: 'input' },
        { id: 'c', type: 'slider2', name: 'x' },
        { id: 'p', type: 'page', title: '孤立', children: [] },
        { id: 't', type: 'tabs', children: [{ id: 'f', type: 'input', name: 'y' } as any] },
        { id: 'v', type: 'input', name: 'v', visibleWhen: 'values.nope == 1' },
        {
          ...guests,
          id: 'l',
          children: [{ id: 'in', type: 'input', name: 'name', visibleWhen: 'item.name' }],
        },
        {
          id: 'l2',
          type: 'list',
          name: 'rows',
          children: [
            { id: 'r1', type: 'input-number', name: 'a', formula: 'item.b' },
            { id: 'r2', type: 'input-number', name: 'b', formula: 'item.a + item.pricee' },
          ],
        },
        { id: 'l3', type: 'list', children: [] } as any,
        { id: 's', type: 'steps', children: [] },
        { id: 'out', type: 'input', name: 'out', visibleWhen: 'item.x' },
        { id: 'f1', type: 'input-number', name: 'f1', formula: 'values.f2' },
        { id: 'f2', type: 'input-number', name: 'f2', formula: 'values.f1' },
      ]),
    )
    expect(problems.map((problem) => [problem.code, problem.text])).toEqual([
      ['duplicate-id', 'a'],
      ['missing-name', 'b'],
      ['unknown-type', 'slider2'],
      ['misplaced-page', 'p'],
      ['not-a-page', 'f'],
      ['expression', 'values.nope == 1'],
      ['expression', 'item.a + item.pricee'],
      ['empty', 'l3'],
      ['missing-name', 'l3'],
      ['empty', 's'],
      ['expression', 'item.x'],
      ['duplicate-name', 'name'],
      ['formula-cycle', 'f1 → f2'],
      ['formula-cycle', 'a → b'],
    ])
    expect(problems.find((problem) => problem.code === 'expression')!.property).toBe('visibleWhen')
    const item = problems.find((problem) => problem.nodeId === 'r2')!
    expect(item.expression!.text).toBe('item.pricee')
    expect(
      problems.filter((problem) => problem.code === 'formula-cycle').map((p) => p.nodeId),
    ).toEqual(['f1', 'r1'])
  })

  it('accepts a sound document, names inside lists apart from the rest', () => {
    expect(checkDocument(doc([{ id: 'n', type: 'input', name: 'name' }, guests]))).toEqual([])
  })

  it('migrates the current version as is and refuses unknown ones', () => {
    const current = doc([])
    expect(migrateDocument(current as any)).toBe(current)
    expect(() => migrateDocument({ version: 9, nodes: [] })).toThrow(/version 9/)
    expect(migrateDocument({ nodes: [] })).toEqual({ version: 1, nodes: [] })
    expect(() => migrateDocument(null)).toThrow(/\[dou-ui\] a form document must be an object/)
  })
})

describe('messages', () => {
  it('follows the locale and takes overrides', () => {
    let texts: ReturnType<typeof useFormBuilderMessages> | undefined
    const Probe = defineComponent(() => {
      texts = useFormBuilderMessages({ next: 'Continue', document: { version: 'v{text}?' } })
      return () => null
    })
    mount(DouConfigProvider, { props: { locale: en }, slots: { default: () => h(Probe) } })
    expect(texts!.value.prev).toBe('Back')
    expect(texts!.value.next).toBe('Continue')
    expect(texts!.value.document.version).toBe('v{text}?')
    expect(texts!.value.document['duplicate-id']).toContain('used twice')
  })
})
