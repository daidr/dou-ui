import { describe, expect, it } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { CopyIcon } from '@dou-ui/icons'
import {
  checkDocumentShape,
  defineFormBuilderExtension,
  checkDocument,
  DouFormBuilder,
  FormBuilderTransaction,
  resolveFormBuilderExtensions,
  resolveFormBuilderFields,
  defineFormField,
} from '../index'
import type {
  FormBuilderExpose,
  FormBuilderExtension,
  FormDocument,
  FormNode,
  FormSectionNode,
} from '../index'
import { parseCondition, printCondition } from '../builder/condition'
import { completeExpression } from '../builder/completion'
import { replaceDocument } from '../builder/core/commands'
import { formBuilderLocales } from '../builder/locale'
import { itemToRule, logicScope, ruleToItem } from '../builder/logic'
import { resolveFields } from '../fields/builtin'

const doc = (nodes: FormNode[]): FormDocument => ({ version: 1, nodes })
const messages = formBuilderLocales['zh-CN']!

const flush = async () => {
  for (let round = 0; round < 3; round++) {
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve))
  }
  await nextTick()
}

const sample = () =>
  doc([
    {
      id: 's',
      type: 'section',
      title: '联系人',
      children: [
        { id: 'name', type: 'input', name: 'name', label: '姓名' },
        { id: 'phone', type: 'input', name: 'phone', label: '手机号' },
      ],
    },
    {
      id: 'city',
      type: 'select',
      name: 'city',
      label: '城市',
      props: { options: [{ label: '上海', value: 'sh' }] },
    },
    { id: 'vip', type: 'switch', name: 'vip', label: '会员' },
    {
      id: 'guests',
      type: 'list',
      name: 'guests',
      label: '同行人',
      children: [{ id: 'guest', type: 'input', name: 'name', label: '姓名' }],
    },
  ])

describe('conditions', () => {
  it('reads rows joined by one operator and writes them back', () => {
    const source = "values.city == 'sh' && !empty(values.phone) && values.age >= 18"
    const condition = parseCondition(source)!
    expect(condition.join).toBe('and')
    expect(condition.rows).toEqual([
      { scope: 'values', path: 'city', op: 'eq', value: 'sh' },
      { scope: 'values', path: 'phone', op: 'filled' },
      { scope: 'values', path: 'age', op: 'ge', value: 18 },
    ])
    expect(printCondition(condition)).toBe(source)
  })

  it('reads lists, contains, item paths, keys that are not names and negative numbers', () => {
    const source =
      "values.city in ['sh', 'hz'] || contains(values.tags, 'vip') || item['first-name'] != 'it\\'s' || values.n > -2"
    const condition = parseCondition(source)!
    expect(condition.join).toBe('or')
    expect(condition.rows.map((row) => row.op)).toEqual(['in', 'contains', 'ne', 'gt'])
    expect(condition.rows[2]).toMatchObject({ scope: 'item', path: 'first-name', value: "it's" })
    expect(condition.rows[3]!.value).toBe(-2)
    expect(printCondition(condition)).toBe(source)
  })

  it('leaves other expressions as text', () => {
    expect(parseCondition('values.a && values.b || values.c')).toBeUndefined()
    expect(parseCondition('values.price * 2 > 10')).toBeUndefined()
    expect(parseCondition('values.a ==')).toBeUndefined()
    expect(parseCondition('')).toEqual({ join: 'and', rows: [] })
  })

  it('writes only the rows that are filled in', () => {
    expect(
      printCondition({
        join: 'and',
        rows: [
          { scope: 'values', path: 'city', op: 'eq' },
          { scope: 'values', path: '', op: 'eq', value: 'sh' },
          { scope: 'values', path: 'vip', op: 'eq', value: true },
        ],
      }),
    ).toBe('values.vip == true')
  })
})

describe('completions', () => {
  const scope = {
    names: [
      { path: 'city', label: '城市' },
      { path: 'contact.phone', label: '电话' },
    ],
    functions: ['len', 'sum'],
  }
  const labels = { values: 'v', item: 'i', value: 'x' }

  it('completes paths after values. and replaces the word at the caret', () => {
    const text = 'values.c > 1'
    const list = completeExpression(text, 8, scope, labels)
    expect(list.map((c) => c.label)).toEqual(['city', 'contact.phone'])
    expect(list[0]).toMatchObject({ text: 'values.city > 1', caret: 11, description: '城市' })
  })

  it('offers the roots and functions, and nothing inside text', () => {
    expect(completeExpression('su', 2, scope, labels).map((c) => c.label)).toEqual(['sum()'])
    expect(
      completeExpression('va', 2, { ...scope, value: true }, labels).map((c) => c.label),
    ).toEqual(['values.', 'value'])
    expect(completeExpression("'va", 3, scope, labels)).toEqual([])
    expect(completeExpression('item.', 5, scope, labels)).toEqual([])
  })
})

describe('logic settings', () => {
  it('lists what a node reads, with the item of the list around it', () => {
    const fields = resolveFields()
    const outside = logicScope(sample(), 'city', fields, messages)
    expect(outside.itemNames).toBeUndefined()
    expect(outside.targets.map((t) => `${t.path}:${t.kind}`)).toEqual([
      'name:text',
      'phone:text',
      'city:choice',
      'vip:boolean',
      'guests:list',
    ])
    expect(outside.targets[2]!.options).toEqual([{ label: '上海', value: 'sh' }])
    const inside = logicScope(sample(), 'guest', fields, messages)
    expect(inside.itemNames).toEqual(['name'])
    expect(inside.targets[0]).toMatchObject({ scope: 'item', path: 'name' })
  })

  it('turns rules into rows of the editor and back, keeping only the keys of their kind', () => {
    expect(ruleToItem({ pattern: '^\\d+$', message: '数字' })).toMatchObject({ kind: 'pattern' })
    expect(ruleToItem({ min: 2 })).toMatchObject({ kind: 'range' })
    expect(ruleToItem({ check: 'value > 1' }).kind).toBe('check')
    expect(
      itemToRule({
        kind: 'range',
        min: 2,
        pattern: 'x',
        type: 'email',
        trigger: 'auto',
        message: '',
      }),
    ).toEqual({ min: 2 })
    expect(itemToRule({ kind: 'type', trigger: 'blur' })).toEqual({
      type: 'email',
      trigger: 'blur',
    })
  })
})

describe('checkDocumentShape', () => {
  it('names the path of each value of the wrong kind or missing', () => {
    const problems = checkDocumentShape({
      version: 1,
      columns: '12',
      nodes: [
        { id: 'a', type: 'input', label: 3, rules: [{ min: 'x' }] },
        { type: 'section' },
        'oops',
        { id: 'b', type: 'input', span: { sm: 'half' }, source: {} },
      ],
    })
    expect(problems.map((p) => `${p.path} ${p.code} ${p.expected}`)).toEqual([
      'columns type number',
      'nodes[0].label type string',
      'nodes[0].rules[0].min type number',
      'nodes[1].id required string',
      'nodes[1].children required array',
      'nodes[2] type object',
      'nodes[3].span type span',
      'nodes[3].source.name required string',
    ])
    expect(checkDocumentShape([])).toMatchObject([{ path: '', expected: 'object' }])
    expect(checkDocumentShape({ version: 1 })).toMatchObject([{ path: 'nodes', code: 'required' }])
    expect(checkDocumentShape(sample())).toEqual([])
  })

  it('gives each problem of checkDocument the path of the node at fault', () => {
    const problems = checkDocument({
      version: 1,
      nodes: [
        { id: 'a', type: 'input', name: 'a' },
        { id: 'a', type: 'zzz', name: 'b' },
        {
          id: 's',
          type: 'section',
          children: [{ id: 'c', type: 'input', name: 'a', rules: [{ check: 'value > valuse.x' }] }],
        },
      ],
    } as FormDocument)
    expect(problems.map((p) => `${p.code} ${p.path}`)).toEqual([
      'duplicate-id nodes[1]',
      'unknown-type nodes[1]',
      'expression nodes[2].children[0].rules[0].check',
      'duplicate-name nodes[2].children[0]',
    ])
  })
})

describe('replaceDocument', () => {
  it('swaps the nodes and the settings in steps that undo', () => {
    const before = { ...sample(), layout: 'horizontal' as const }
    const next: FormDocument = {
      version: 1,
      columns: 6,
      nodes: [{ id: 'x', type: 'input', name: 'x' }],
    }
    const tr = new FormBuilderTransaction(before)
    replaceDocument(tr, next)
    expect(tr.doc).toEqual(next)
    const back = new FormBuilderTransaction(tr.doc)
    for (const step of tr.inverse) back.step(step)
    expect(back.doc).toEqual(before)
  })
})

function setup(extensions: FormBuilderExtension[], selection: string[] = []) {
  const form = ref(sample())
  const selected = ref(selection)
  const wrapper = mount(
    {
      render: () =>
        h(DouFormBuilder, {
          ref: 'builder',
          modelValue: form.value,
          'onUpdate:modelValue': (next: FormDocument) => (form.value = next),
          selection: selected.value,
          'onUpdate:selection': (next: string[]) => (selected.value = next),
          extensions,
        }),
    },
    { attachTo: document.body },
  )
  const api = () => wrapper.vm.$refs.builder as FormBuilderExpose
  return { wrapper, form, selected, api }
}

describe('extensions', () => {
  it('sorts by priority, refuses a name twice and collects field types', () => {
    const chip = defineFormField({ type: 'chip', component: { render: () => null } })
    const a = defineFormBuilderExtension({ name: 'a' })
    const b = defineFormBuilderExtension({ name: 'b', priority: 200, fields: [chip] })
    expect(resolveFormBuilderExtensions([a, [b]]).extensions.map((e) => e.name)).toEqual(['b', 'a'])
    expect(() => resolveFormBuilderExtensions([a, a])).toThrow(/added twice/)
    expect(resolveFormBuilderFields([], [b]).map((f) => f.type)).toEqual(['chip'])
  })

  it('adds steps to changes, keys, toolbar buttons and menu items', async () => {
    const seen: string[] = []
    let stopped = false
    const ext = defineFormBuilderExtension({
      name: 'audit',
      // Every new field gets a help text, in the same undo step.
      transaction(tr) {
        for (const step of tr.steps)
          if (step.type === 'insert' && !('help' in step.node) && step.node.type === 'input')
            tr.update(step.node.id, { help: '由扩展补上' })
      },
      keymap: (context) => ({
        'mod+e': () => {
          seen.push(`key:${context.selection.join()}`)
        },
        'mod+d': () => false,
      }),
      toolbar: () => [
        {
          key: 'hi',
          label: '打招呼',
          icon: CopyIcon,
          shortcut: 'alt+h',
          run: () => seen.push('toolbar'),
        },
      ],
      menu: (_context, nodes) => [
        {
          key: 'log',
          label: '记下',
          run: () => seen.push(`menu:${nodes.map((n) => n.id).join()}`),
        },
      ],
      setup: () => () => (stopped = true),
    })
    const { wrapper, form, api } = setup([ext], ['city'])
    await flush()

    api().add('input')
    await flush()
    const added = form.value.nodes[2]!
    expect(added).toMatchObject({ type: 'input', help: '由扩展补上' })
    api().undo()
    await flush()
    expect(form.value.nodes.map((n) => n.id)).not.toContain(added.id)

    api().select('city')
    await flush()
    const tree = wrapper.find('.dou-form-builder__tree')
    await tree.trigger('keydown', { key: 'e', ctrlKey: true })
    // A handler that returns false lets the key through to the builder.
    await tree.trigger('keydown', { key: 'd', ctrlKey: true })
    await flush()
    expect(seen).toEqual(['key:city'])
    expect(form.value.nodes.filter((n) => n.type === 'select')).toHaveLength(2)

    // The key is a hint apart from the name.
    const hi = wrapper.find('button[aria-label="打招呼"]')
    expect(hi.attributes('aria-keyshortcuts')).toBe('Alt+H')
    expect(hi.attributes('title')).toBe('打招呼（Alt+H）')
    await hi.trigger('click')
    expect(seen).toContain('toolbar')

    // The node's menu button shows at any width once an extension adds items.
    expect(wrapper.find('.dou-form-builder__actions').attributes('data-extra')).toBe('true')

    wrapper.unmount()
    expect(stopped).toBe(true)
  })

  it('replaces the form as one undo step and switches to the preview', async () => {
    const { wrapper, form, api } = setup([])
    await flush()
    api().replace({ version: 1, nodes: [{ id: 'q', type: 'input', name: 'q', label: '问题' }] })
    await flush()
    expect(form.value.nodes.map((n) => n.id)).toEqual(['q'])
    expect(wrapper.find('.dou-form-builder__live').text()).toBe('已换成导入的表单')
    api().undo()
    await flush()
    expect((form.value.nodes[0] as FormSectionNode).title).toBe('联系人')

    api().setMode('preview')
    await flush()
    expect(api().mode).toBe('preview')
    expect(wrapper.find('.dou-form-builder__canvas').exists()).toBe(false)
    expect(wrapper.find('.dou-form-builder__preview-frame .dou-form-renderer').exists()).toBe(true)
    wrapper.unmount()
  })
})
