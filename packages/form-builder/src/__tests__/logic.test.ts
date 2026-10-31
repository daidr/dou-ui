import { describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { DouFormRenderer } from '../index'
import type { FormDocument } from '../index'

const doc = (nodes: FormDocument['nodes']): FormDocument => ({ version: 1, nodes })

const flush = async () => {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve))
  await nextTick()
}

describe('visibleWhen', () => {
  it('shows a node only while its expression is true, and skips it on submit', async () => {
    const model = reactive<Record<string, any>>({})
    const wrapper = mount(DouFormRenderer, {
      props: {
        model,
        form: doc([
          { id: 'k', type: 'select', name: 'kind', props: { options: ['laptop', 'phone'] } },
          {
            id: 'm',
            type: 'input',
            name: 'memory',
            label: '内存',
            required: true,
            visibleWhen: "values.kind == 'laptop'",
          },
          {
            id: 's',
            type: 'section',
            title: '保修',
            visibleWhen: 'values.kind != null',
            children: [{ id: 'y', type: 'input-number', name: 'years', label: '年限' }],
          },
        ]),
      },
    })
    expect(wrapper.find('[data-node="m"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('保修')
    expect(await (wrapper.vm as any).validate()).toEqual({ valid: true, errors: {} })

    model.kind = 'laptop'
    await nextTick()
    expect(wrapper.find('[data-node="m"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('保修')
    expect((await (wrapper.vm as any).validate()).errors).toHaveProperty('memory')

    model.kind = 'phone'
    await nextTick()
    expect(wrapper.find('[data-node="m"]').exists()).toBe(false)
    expect((await (wrapper.vm as any).validate()).valid).toBe(true)
  })

  it('shows a node whose expression does not parse, and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(DouFormRenderer, {
      props: {
        form: doc([
          { id: 'a', type: 'input', name: 'a', visibleWhen: 'values.x = 1' },
          { id: 'b', type: 'input', name: 'b', visibleWhen: 'values.x = 1' },
        ]),
      },
    })
    expect(wrapper.findAll('input')).toHaveLength(2)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('Use == to compare')
    warn.mockRestore()
  })

  it('re-renders only the nodes that read the changed value', async () => {
    const model = reactive<Record<string, any>>({})
    const nodes: FormDocument['nodes'] = [{ id: 'gate', type: 'switch', name: 'gate' }]
    for (let i = 0; i < 20; i++)
      nodes.push({
        id: `f${i}`,
        type: 'input',
        name: `f${i}`,
        visibleWhen: i % 2 ? 'values.gate' : undefined,
      })
    const wrapper = mount(DouFormRenderer, { props: { model, form: doc(nodes) } })
    expect(wrapper.findAll('input[type="text"], input:not([type])').length).toBe(10)
    model.gate = true
    await nextTick()
    expect(wrapper.findAll('[data-node^="f"]')).toHaveLength(20)
  })
})

describe('disabledWhen and requiredWhen', () => {
  it('disables a field, and every field in a disabled group', async () => {
    const model = reactive<Record<string, any>>({ lock: false })
    const wrapper = mount(DouFormRenderer, {
      props: {
        model,
        form: doc([
          { id: 'a', type: 'input', name: 'a', disabledWhen: 'values.lock' },
          {
            id: 's',
            type: 'section',
            disabledWhen: 'values.lock',
            children: [
              { id: 'b', type: 'input', name: 'b' },
              { id: 'c', type: 'switch', name: 'c' },
            ],
          },
        ]),
      },
    })
    const disabled = () =>
      ['a', 'b'].map(
        (id) => wrapper.find(`[data-node="${id}"] input`).attributes('disabled') !== undefined,
      )
    expect(disabled()).toEqual([false, false])
    model.lock = true
    await nextTick()
    expect(disabled()).toEqual([true, true])
    expect(wrapper.find('[data-node="s"] [role="group"]').attributes('aria-disabled')).toBe('true')
    expect(
      wrapper.find('[data-node="c"] button, [data-node="c"] input').attributes('disabled'),
    ).toBeDefined()
  })

  it('makes a field required while its expression is true, mark included', async () => {
    const model = reactive<Record<string, any>>({ invoice: false })
    const wrapper = mount(DouFormRenderer, {
      props: {
        model,
        form: doc([
          { id: 'i', type: 'switch', name: 'invoice' },
          { id: 't', type: 'input', name: 'title', label: '抬头', requiredWhen: 'values.invoice' },
        ]),
      },
    })
    const item = () => wrapper.find('[data-node="t"] .dou-form-item')
    expect(item().classes()).not.toContain('is-required')
    expect((await (wrapper.vm as any).validate()).valid).toBe(true)
    model.invoice = true
    await nextTick()
    expect(item().classes()).toContain('is-required')
    expect((await (wrapper.vm as any).validate()).errors).toHaveProperty('title')
  })
})

describe('formula', () => {
  it('holds the result, follows chains and cannot be typed in', async () => {
    const model = reactive<Record<string, any>>({ price: 100, count: 2 })
    const wrapper = mount(DouFormRenderer, {
      props: {
        model,
        form: doc([
          { id: 'p', type: 'input-number', name: 'price' },
          { id: 'c', type: 'input-number', name: 'count' },
          { id: 't', type: 'input-number', name: 'total', formula: 'values.subtotal + values.tax' },
          {
            id: 'x',
            type: 'input-number',
            name: 'tax',
            formula: 'round(values.subtotal * 0.06, 2)',
          },
          {
            id: 's',
            type: 'input-number',
            name: 'subtotal',
            formula: 'values.price * values.count',
          },
          { id: 'n', type: 'input', name: 'note', formula: "'共 ' + values.count + ' 件'" },
        ]),
      },
    })
    expect(model).toMatchObject({ subtotal: 200, tax: 12, total: 212, note: '共 2 件' })
    model.count = 3
    expect(model).toMatchObject({ subtotal: 300, tax: 18, total: 318, note: '共 3 件' })
    await nextTick()
    expect(wrapper.find('[data-node="n"] input').attributes('readonly')).toBeDefined()
    expect(wrapper.find('[data-node="t"] input').attributes('readonly')).toBeDefined()
  })

  it('works out the result before the form takes its starting values, so reset keeps it', async () => {
    const model = reactive<Record<string, any>>({})
    const wrapper = mount(DouFormRenderer, {
      props: {
        model,
        form: doc([
          { id: 'a', type: 'input-number', name: 'a', default: 2 },
          { id: 'b', type: 'input-number', name: 'b', formula: 'values.a * 10' },
        ]),
      },
    })
    model.a = 5
    expect(model.b).toBe(50)
    ;(wrapper.vm as any).resetFields()
    await nextTick()
    expect(model).toEqual({ a: 2, b: 20 })
  })

  it('skips formulas that read each other in a circle, and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const model = reactive<Record<string, any>>({})
    mount(DouFormRenderer, {
      props: {
        model,
        form: doc([
          { id: 'a', type: 'input-number', name: 'a', formula: 'values.b + 1' },
          { id: 'b', type: 'input-number', name: 'b', formula: 'values.a + 1' },
          { id: 'c', type: 'input-number', name: 'c', formula: '1 + 1' },
        ]),
      },
    })
    expect(model).toEqual({ a: null, b: null, c: 2 })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('a -> b')
    warn.mockRestore()
  })

  it('calls the functions given to the renderer', () => {
    const model = reactive<Record<string, any>>({ price: 200 })
    mount(DouFormRenderer, {
      props: {
        model,
        functions: { discount: (price: number) => (price >= 100 ? price - 20 : price) },
        form: doc([
          { id: 'd', type: 'input-number', name: 'pay', formula: 'discount(values.price)' },
        ]),
      },
    })
    expect(model.pay).toBe(180)
  })

  it('does not report formula results as changes', async () => {
    const onChange = vi.fn<(name: string, value: unknown) => void>()
    const wrapper = mount(DouFormRenderer, {
      props: {
        onChange,
        form: doc([
          { id: 'a', type: 'input', name: 'a' },
          { id: 'b', type: 'input', name: 'b', formula: "values.a + '!'" },
        ]),
      },
    })
    await wrapper.find('[data-node="a"] input').setValue('hi')
    expect(onChange.mock.calls).toEqual([['a', 'hi']])
    expect((wrapper.vm as any).model.b).toBe('hi!')
  })
})

describe('check rules', () => {
  it('checks against other fields and rechecks when they change', async () => {
    const model = reactive<Record<string, any>>({ start: '2026-10-10', end: '2026-10-05' })
    const wrapper = mount(DouFormRenderer, {
      props: {
        model,
        form: doc([
          { id: 's', type: 'input', name: 'start' },
          {
            id: 'e',
            type: 'input',
            name: 'end',
            rules: [{ check: 'value >= values.start', message: '结束不能早于开始' }],
          },
        ]),
      },
    })
    const result = await (wrapper.vm as any).validate()
    expect(result.errors).toEqual({ end: '结束不能早于开始' })
    await flush()
    expect(wrapper.text()).toContain('结束不能早于开始')

    model.start = '2026-10-01'
    await flush()
    expect(wrapper.text()).not.toContain('结束不能早于开始')
  })

  it('leaves an empty value to required', async () => {
    const wrapper = mount(DouFormRenderer, {
      props: {
        form: doc([{ id: 'a', type: 'input', name: 'a', rules: [{ check: 'len(value) > 3' }] }]),
      },
    })
    expect((await (wrapper.vm as any).validate()).valid).toBe(true)
  })
})

describe('option sources', () => {
  it('loads options with the arg, again when they change, sharing calls', async () => {
    const cities = vi.fn<(province: string) => Promise<unknown[]>>(async (province) =>
      province === 'sh' ? [{ value: 'pd', label: '浦东' }] : [{ value: 'hz', label: '杭州' }],
    )
    const model = reactive<Record<string, any>>({ province: 'sh' })
    const wrapper = mount(DouFormRenderer, {
      props: {
        model,
        sources: { cities },
        form: doc([
          {
            id: 'c',
            type: 'radio-group',
            name: 'city',
            source: { name: 'cities', arg: 'values.province' },
          },
          {
            id: 'd',
            type: 'radio-group',
            name: 'city2',
            source: { name: 'cities', arg: 'values.province' },
          },
        ]),
      },
    })
    await flush()
    expect(cities).toHaveBeenCalledTimes(1)
    expect(cities).toHaveBeenLastCalledWith('sh')
    expect(wrapper.find('[data-node="c"]').text()).toBe('浦东')
    expect(wrapper.find('[data-node="d"]').text()).toBe('浦东')

    model.province = 'zj'
    await flush()
    expect(cities).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-node="c"]').text()).toBe('杭州')

    model.province = 'sh'
    await flush()
    expect(cities).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-node="c"]').text()).toBe('浦东')
  })

  it('keeps the newest answer when an older one arrives later', async () => {
    const resolvers: Record<string, (list: unknown[]) => void> = {}
    const model = reactive<Record<string, any>>({ q: 'a' })
    const wrapper = mount(DouFormRenderer, {
      props: {
        model,
        sources: {
          list: (q: string) => new Promise<unknown[]>((resolve) => (resolvers[q] = resolve)),
        },
        form: doc([
          { id: 'r', type: 'radio-group', name: 'r', source: { name: 'list', arg: 'values.q' } },
        ]),
      },
    })
    await flush()
    model.q = 'b'
    await flush()
    resolvers.b!(['新'])
    await flush()
    resolvers.a!(['旧'])
    await flush()
    expect(wrapper.find('[data-node="r"]').text()).toBe('新')
  })

  it('shows no options and warns when a source fails, then tries again', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let fail = true
    const model = reactive<Record<string, any>>({ q: 1 })
    const wrapper = mount(DouFormRenderer, {
      props: {
        model,
        sources: {
          list: () => {
            if (fail) throw new Error('网络错误')
            return ['好']
          },
        },
        form: doc([
          { id: 'r', type: 'radio-group', name: 'r', source: { name: 'list', arg: 'values.q' } },
        ]),
      },
    })
    await flush()
    expect(wrapper.find('[data-node="r"]').text()).toBe('')
    expect(warn).toHaveBeenCalled()
    fail = false
    model.q = 2
    await flush()
    expect(wrapper.find('[data-node="r"]').text()).toBe('好')
    warn.mockRestore()
  })

  it('passes loading to a component that takes it', async () => {
    let resolve!: (list: unknown[]) => void
    const wrapper = mount(DouFormRenderer, {
      props: {
        sources: { list: () => new Promise<unknown[]>((r) => (resolve = r)) },
        form: doc([{ id: 's', type: 'select', name: 's', source: { name: 'list' } }]),
      },
    })
    await flush()
    const select = wrapper.findComponent({ name: 'DouSelect' })
    expect(select.props('loading')).toBe(true)
    resolve([{ value: 1, label: '一' }])
    await flush()
    expect(select.props('loading')).toBe(false)
    expect(select.props('options')).toEqual([{ value: 1, label: '一' }])
  })

  it('clears a value the new options no longer offer, unless the source keeps it', async () => {
    const regions: Record<string, string[]> = {
      上海: ['徐汇区', '浦东新区'],
      浙江: ['杭州', '宁波'],
    }
    const model = reactive<Record<string, any>>({
      province: '上海',
      city: '徐汇区',
      cities: ['徐汇区', '浦东新区'],
      kept: '徐汇区',
    })
    mount(DouFormRenderer, {
      props: {
        model,
        sources: { cities: (province: string) => [...(regions[province] ?? []), '共用'] },
        form: doc([
          {
            id: 'c',
            type: 'select',
            name: 'city',
            source: { name: 'cities', arg: 'values.province' },
          },
          {
            id: 'm',
            type: 'checkbox-group',
            name: 'cities',
            source: { name: 'cities', arg: 'values.province' },
          },
          {
            id: 'k',
            type: 'select',
            name: 'kept',
            source: { name: 'cities', arg: 'values.province', keep: true },
          },
        ]),
      },
    })
    await flush()
    // The first options leave a value as it is, e.g. one loaded with the record.
    expect(model.city).toBe('徐汇区')
    model.cities.push('共用')
    model.province = '浙江'
    await flush()
    expect(model).toMatchObject({ city: null, cities: ['共用'], kept: '徐汇区' })
  })

  it('narrows a path to the levels the options still have', async () => {
    const { fitPathToOptions, fitToOptions } = await import('../index')
    const tree = [{ value: 'sh', children: [{ value: 'xh' }] }, { value: 'zj' }]
    expect(fitPathToOptions(['sh', 'xh'], tree)).toEqual(['sh', 'xh'])
    expect(fitPathToOptions(['sh', 'pd'], tree)).toBe(null)
    expect(
      fitPathToOptions(
        [
          ['sh', 'xh'],
          ['zj', 'hz'],
        ],
        tree,
      ),
    ).toEqual([['sh', 'xh']])
    expect(fitToOptions('a', [{ label: '组', options: ['a'] }])).toBe('a')
    const same = ['a']
    expect(fitToOptions(same, ['a', 'b'])).toBe(same)
  })

  it('loads again after reloadSource, for one source or all', async () => {
    let round = 1
    const list = vi.fn<() => string[]>(() => [`第 ${round} 次`])
    const wrapper = mount(DouFormRenderer, {
      props: {
        sources: { list },
        form: doc([{ id: 'r', type: 'radio-group', name: 'r', source: { name: 'list' } }]),
      },
    })
    await flush()
    expect(wrapper.find('[data-node="r"]').text()).toBe('第 1 次')
    round = 2
    ;(wrapper.vm as any).reloadSource('list')
    await flush()
    expect(wrapper.find('[data-node="r"]').text()).toBe('第 2 次')
    round = 3
    ;(wrapper.vm as any).reloadSource()
    await flush()
    expect(wrapper.find('[data-node="r"]').text()).toBe('第 3 次')
    expect(list).toHaveBeenCalledTimes(3)
  })
})
