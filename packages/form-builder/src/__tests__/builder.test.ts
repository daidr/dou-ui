import { describe, expect, it } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import {
  applyFormSteps,
  DouFormBuilder,
  FormBuilderHistory,
  FormBuilderTransaction,
  formNodePlaces,
} from '../index'
import type { FormBuilderExpose, FormDocument, FormNode, FormSectionNode } from '../index'
import {
  dropPlaces,
  duplicateNodes,
  insertPlace,
  moveNodesTo,
  moveNodes,
  removeNodes,
  wrapNodes,
} from '../builder/core/commands'
import { formBuilderLocales } from '../builder/locale'
import { resolveFields } from '../fields/builtin'

const doc = (nodes: FormNode[]): FormDocument => ({ version: 1, nodes })

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
    { id: 'city', type: 'select', name: 'city', label: '城市', props: { options: ['上海'] } },
  ])

const context = { fields: resolveFields(), messages: formBuilderLocales['zh-CN']! }

describe('FormBuilderTransaction', () => {
  it('copies only the nodes on the way to a change', () => {
    const before = sample()
    const tr = new FormBuilderTransaction(before).update('phone', { label: '电话' })
    const after = tr.doc
    expect(after).not.toBe(before)
    expect(after.nodes[0]).not.toBe(before.nodes[0])
    // untouched nodes are shared
    expect(after.nodes[1]).toBe(before.nodes[1])
    expect((after.nodes[0] as FormSectionNode).children[0]).toBe(
      (before.nodes[0] as FormSectionNode).children[0],
    )
    expect(formNodePlaces(after).get('phone')!.node).toMatchObject({ label: '电话' })
    // the document handed in stays as it was
    expect(formNodePlaces(before).get('phone')!.node).toMatchObject({ label: '手机号' })
  })

  it('undoes every kind of step with its inverse', () => {
    const before = sample()
    const tr = new FormBuilderTransaction(before)
      .insert({ id: 'mail', type: 'input', name: 'mail' }, 's', 1)
      .update('name', { label: undefined, help: '真实姓名' })
      .move('city', 's', 0)
      .remove('phone')
      .updateDocument({ layout: 'horizontal' })
    const after = tr.doc
    expect(after.layout).toBe('horizontal')
    expect((after.nodes[0] as FormSectionNode).children.map((node) => node.id)).toEqual([
      'city',
      'name',
      'mail',
    ])
    expect(formNodePlaces(after).get('name')!.node).not.toHaveProperty('label')
    const back = applyFormSteps(after, tr.inverse).doc
    expect(back).toEqual(before)
  })

  it('refuses steps that would break the tree', () => {
    const tr = new FormBuilderTransaction(sample())
    expect(() => tr.move('s', 's', 0)).toThrow(/inside itself/)
    expect(() => tr.insert({ id: 'name', type: 'input' })).toThrow(/already/)
    expect(() => tr.insert({ id: 'x', type: 'input' }, 'name')).toThrow(/holds no other/)
    expect(() => tr.remove('nope')).toThrow(/no node/)
  })

  it('keeps pages in tabs and steps, and only pages there', () => {
    const tabs = doc([
      { id: 't', type: 'tabs', children: [{ id: 'p', type: 'page', title: '一', children: [] }] },
      { id: 'f', type: 'input', name: 'f' },
    ])
    const tr = new FormBuilderTransaction(tabs)
    expect(() => tr.insert({ id: 'x', type: 'input' }, 't')).toThrow(/holds only pages/)
    expect(() => tr.move('f', 't', 0)).toThrow(/holds only pages/)
    expect(() => tr.insert({ id: 'q', type: 'page', children: [] } as FormNode)).toThrow(
      /only go in tabs or steps/,
    )
    expect(() => tr.move('p', null, 0)).toThrow(/only go in tabs or steps/)
    expect(tr.changed).toBe(false)
    tr.insert({ id: 'q', type: 'page', children: [] } as FormNode, 't').move('f', 'q', 0)
    expect(formNodePlaces(tr.doc).get('f')!.parent!.id).toBe('q')
  })

  it('does not update the keys that steps change', () => {
    const tr = new FormBuilderTransaction(sample())
    for (const key of ['id', 'type', 'children'])
      expect(() => tr.update('s', { [key]: 'x' })).toThrow(/cannot be updated/)
  })
})

describe('FormBuilderHistory', () => {
  it('merges changes of one group within a second into one undo step', () => {
    const history = new FormBuilderHistory()
    let current = sample()
    for (const [label, time] of [
      ['姓', 0],
      ['姓名', 400],
      ['姓名全称', 800],
    ] as const) {
      const tr = new FormBuilderTransaction(current).update('name', { label })
      tr.setMeta('group', 'label')
      history.record(tr, ['name'], ['name'], time)
      current = tr.doc
    }
    const undone = history.undo(current)!
    expect(formNodePlaces(undone.tr.doc).get('name')!.node).toMatchObject({ label: '姓名' })
    expect(history.canUndo).toBe(false)
    const redone = history.redo(undone.tr.doc)!
    expect(formNodePlaces(redone.tr.doc).get('name')!.node).toMatchObject({ label: '姓名全称' })
  })
})

const shown = () => undefined

describe('builder commands', () => {
  it('inserts into a selected container, after a selected node, or at the end', () => {
    const document = sample()
    expect(insertPlace(document, ['s'], 'input', shown)).toEqual({ parent: 's', index: 2 })
    expect(insertPlace(document, ['name'], 'input', shown)).toEqual({ parent: 's', index: 1 })
    expect(insertPlace(document, [], 'input', shown)).toEqual({ parent: null, index: 2 })
    // a page goes into tabs only, so with a field selected it goes up to the top
    const tabs = doc([
      { id: 't', type: 'tabs', children: [{ id: 'p', type: 'page', title: '一', children: [] }] },
    ])
    expect(insertPlace(tabs, ['t'], 'input', (node) => node.children[0] as never)).toEqual({
      parent: 'p',
      index: 0,
    })
  })

  it('removes nodes and picks the next one to select', () => {
    const tr = new FormBuilderTransaction(sample())
    expect(removeNodes(tr, ['name', 's'])).toEqual({ removed: 1, next: 'city' })
    const last = new FormBuilderTransaction(sample())
    expect(removeNodes(last, ['phone'])).toEqual({ removed: 1, next: 'name' })
  })

  it('duplicates with new ids and free names', () => {
    const tr = new FormBuilderTransaction(sample())
    const [copy] = duplicateNodes(tr, ['name'])
    const node = formNodePlaces(tr.doc).get(copy!)!
    expect(node.index).toBe(1)
    expect(node.node).toMatchObject({ type: 'input', name: 'name1', label: '姓名' })
    const [section] = duplicateNodes(tr, ['s'])
    const ids = [...formNodePlaces(tr.doc).keys()]
    expect(new Set(ids).size).toBe(ids.length)
    expect(formNodePlaces(tr.doc).get(section!)!.index).toBe(1)
  })

  it('moves a selection one place and keeps its shape at the edge', () => {
    const tr = new FormBuilderTransaction(sample())
    expect(moveNodes(tr, ['phone'], -1)).toBe(true)
    expect((tr.doc.nodes[0] as FormSectionNode).children[0]!.id).toBe('phone')
    expect(moveNodes(tr, ['phone', 'name'], -1)).toBe(false)
  })

  it('moves nodes to a place counted with them still there', () => {
    const tr = new FormBuilderTransaction(sample())
    // after "phone", i.e. the end of the section
    expect(moveNodesTo(tr, ['city', 'name'], 's', 2)).toBe(true)
    expect((tr.doc.nodes[0] as FormSectionNode).children.map((node) => node.id)).toEqual([
      'phone',
      'name',
      'city',
    ])
    // dropping where they already are changes nothing
    const same = new FormBuilderTransaction(sample())
    expect(moveNodesTo(same, ['name'], 's', 1)).toBe(false)
  })

  it('lists the places nodes can go to in reading order', () => {
    const places = dropPlaces(sample(), ['city'], () => undefined)
    expect(places).toEqual([
      { parent: null, index: 0 },
      { parent: 's', index: 0 },
      { parent: 's', index: 1 },
      { parent: 's', index: 2 },
      { parent: null, index: 1 },
      { parent: null, index: 2 },
    ])
    // a section cannot go inside itself
    expect(
      dropPlaces(sample(), ['s'], () => undefined).every((place) => place.parent === null),
    ).toBe(true)
  })

  it('wraps nodes of one container into a section', () => {
    const tr = new FormBuilderTransaction(sample())
    const id = wrapNodes(tr, ['phone', 'name'], context)!
    const section = formNodePlaces(tr.doc).get(id)!.node as FormSectionNode
    expect(section.children.map((node) => node.id)).toEqual(['name', 'phone'])
    expect(wrapNodes(new FormBuilderTransaction(sample()), ['name', 'city'], context)).toBe(
      undefined,
    )
  })
})

function setup(start = sample(), selection: string[] = []) {
  const form = ref(start)
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
        }),
    },
    { attachTo: document.body },
  )
  const api = () => wrapper.vm.$refs.builder as FormBuilderExpose
  return { wrapper, form, selected, api }
}

describe('DouFormBuilder', () => {
  it('adds a field from the palette after the selected node', async () => {
    const { wrapper, form, selected } = setup(sample(), ['name'])
    await flush()
    await wrapper.find('[data-type="date-picker"]').trigger('click')
    await flush()
    const section = form.value.nodes[0] as FormSectionNode
    expect(section.children.map((node) => node.type)).toEqual(['input', 'date-picker', 'input'])
    expect(section.children[1]).toMatchObject({ name: 'datePicker1', label: '日期' })
    expect(selected.value).toEqual([section.children[1]!.id])
    expect(wrapper.find('.dou-form-builder__live').text()).toBe('已添加日期')
    wrapper.unmount()
  })

  it('selects with a press, deletes with a key and undoes', async () => {
    const { wrapper, form, selected } = setup()
    await flush()
    await wrapper.find('.dou-form-builder__node[data-node="phone"]').trigger('click')
    expect(selected.value).toEqual(['phone'])
    await wrapper
      .find('.dou-form-builder__node[data-node="city"]')
      .trigger('click', { shiftKey: true })
    expect(selected.value).toEqual(['phone', 'city'])
    const tree = wrapper.find('[role="tree"].dou-form-builder__tree')
    await tree.trigger('keydown', { key: 'Delete' })
    await flush()
    expect([...formNodePlaces(form.value).keys()]).toEqual(['s', 'name'])
    expect(selected.value).toEqual(['s'])
    await tree.trigger('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true })
    await flush()
    expect(form.value).toEqual(sample())
    expect(selected.value).toEqual(['phone', 'city'])
    wrapper.unmount()
  })

  it('walks the nodes with the arrow keys and reorders them', async () => {
    const { wrapper, form, selected } = setup(sample(), ['s'])
    await flush()
    const tree = wrapper.find('[role="tree"].dou-form-builder__tree')
    await tree.trigger('keydown', { key: 'ArrowDown' })
    expect(selected.value).toEqual(['name'])
    await tree.trigger('keydown', { key: 'ArrowDown', ctrlKey: true })
    await flush()
    expect((form.value.nodes[0] as FormSectionNode).children[1]!.id).toBe('name')
    await tree.trigger('keydown', { key: 'Escape' })
    expect(selected.value).toEqual(['s'])
    expect(tree.attributes('aria-activedescendant')).toContain('-n-s')
    wrapper.unmount()
  })

  it('edits a node in the inspector and leaves defaults out', async () => {
    const { wrapper, form } = setup(sample(), ['name'])
    await flush()
    const inspector = wrapper.find('.dou-form-builder__inspector')
    const label = inspector
      .findAll('input')
      .find((input) => (input.element as HTMLInputElement).value === '姓名')!
    await label.setValue('真实姓名')
    await flush()
    expect(formNodePlaces(form.value).get('name')!.node).toMatchObject({ label: '真实姓名' })
    // clearing a setting removes it from the node
    await label.setValue('')
    await flush()
    expect(formNodePlaces(form.value).get('name')!.node).not.toHaveProperty('label')
    wrapper.unmount()
  })

  it('moves the selection with the keyboard after Space', async () => {
    const { wrapper, form, selected } = setup(sample(), ['city'])
    await flush()
    const tree = wrapper.find('[role="tree"].dou-form-builder__tree')
    await tree.trigger('keydown', { key: ' ' })
    expect(wrapper.find('.dou-form-builder__live').text()).toContain('已拿起')
    // from the end of the section (where city is now: top, 1) up to the start of it
    for (let press = 0; press < 3; press++) await tree.trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.find('.dou-form-builder__live').text()).toBe('放到联系人的第 1 位')
    await tree.trigger('keydown', { key: 'Enter' })
    await flush()
    expect((form.value.nodes[0] as FormSectionNode).children.map((node) => node.id)).toEqual([
      'city',
      'name',
      'phone',
    ])
    expect(selected.value).toEqual(['city'])
    // Escape puts nodes back down where they were
    await tree.trigger('keydown', { key: ' ' })
    await tree.trigger('keydown', { key: 'ArrowDown' })
    await tree.trigger('keydown', { key: 'Escape' })
    await flush()
    expect(wrapper.find('.dou-form-builder__live').text()).toBe('已取消移动')
    expect((form.value.nodes[0] as FormSectionNode).children[0]!.id).toBe('city')
    wrapper.unmount()
  })

  it('takes a new document from outside and starts a new history', async () => {
    const { wrapper, form, api } = setup()
    await flush()
    api().add('input')
    expect(api().canUndo).toBe(true)
    form.value = doc([{ id: 'only', type: 'input', name: 'only' }])
    await flush()
    expect(api().canUndo).toBe(false)
    expect(api().document.nodes.map((node) => node.id)).toEqual(['only'])
    wrapper.unmount()
  })
})
