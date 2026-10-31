import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { collaboration, fillMaps, readMaps } from '..'
import { DouFormBuilder } from '../../index'
import type { FormBuilderExpose, FormDocument, FormFieldNode, FormSectionNode } from '../../index'
import { replaceDocument } from '../../builder/core/commands'
import { FormBuilderTransaction } from '../../builder/core/transaction'
import { keyBetween, orderKeys } from '../order'

const START = (): FormDocument => ({
  version: 1,
  columns: 12,
  nodes: [
    { id: 'name', type: 'input', name: 'name', label: '姓名' },
    {
      id: 'contact',
      type: 'section',
      title: '联系方式',
      children: [
        { id: 'phone', type: 'input', name: 'phone', label: '手机号' },
        { id: 'city', type: 'select', name: 'city', label: '城市', default: 'sh' },
      ],
    },
    { id: 'note', type: 'textarea', name: 'note', label: '备注' },
  ],
})

const wrappers: VueWrapper[] = []
const awarenesses: Awareness[] = []
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  for (const awareness of awarenesses.splice(0)) awareness.destroy()
  document.body.innerHTML = ''
})

const phone = (doc: FormDocument) => (doc.nodes[1] as FormSectionNode).children[0]

const flush = async () => {
  for (let round = 0; round < 3; round++) {
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve))
  }
}

/** A client: its own Y.Doc and a builder bound to it, starting from `start`. */
function client(start: FormDocument, options: { awareness?: boolean; name?: string } = {}) {
  const doc = new Y.Doc()
  const awareness = options.awareness ? new Awareness(doc) : undefined
  if (awareness) awarenesses.push(awareness)
  const form = ref(start)
  const selection = ref<string[]>([])
  const extension = collaboration({
    nodes: doc.getMap('nodes'),
    settings: doc.getMap('form'),
    awareness,
    user: options.name ? { name: options.name } : undefined,
  })
  const wrapper = mount(
    {
      render: () =>
        h(DouFormBuilder, {
          ref: 'builder',
          modelValue: form.value,
          'onUpdate:modelValue': (next: FormDocument) => (form.value = next),
          selection: selection.value,
          'onUpdate:selection': (next: string[]) => (selection.value = next),
          extensions: [extension],
        }),
    },
    { attachTo: document.body },
  )
  wrappers.push(wrapper)
  const api = () => wrapper.vm.$refs.builder as FormBuilderExpose
  return { doc, awareness, form, selection, wrapper, api }
}

/** Two clients that send each other every change, the first one filling the maps. */
async function pair(options: { awareness?: boolean } = {}) {
  const a = client(START(), { ...options, name: '戴兜' })
  await flush()
  const b = client({ version: 1, nodes: [] }, { ...options, name: '阿青' })
  Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc))
  a.doc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin !== 'peer') Y.applyUpdate(b.doc, update, 'peer')
  })
  b.doc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin !== 'peer') Y.applyUpdate(a.doc, update, 'peer')
  })
  await flush()
  return { a, b }
}

describe('order keys', () => {
  it('makes a key between any two and keeps the run already in order', () => {
    const a = keyBetween(null, null)
    const b = keyBetween(a, null)
    expect(a < keyBetween(a, b) && keyBetween(a, b) < b).toBe(true)
    // Moving the last of four to the front gives only that one a new key.
    const keys = ['1', '2', '3', '4']
    const moved = orderKeys(['4', '1', '2', '3'])
    expect(moved.slice(1)).toEqual(keys.slice(0, 3))
    expect(moved[0]! < '1').toBe(true)
  })
})

describe('fillMaps and readMaps', () => {
  it('give back the form they were filled with', () => {
    const doc = new Y.Doc()
    const maps = { nodes: doc.getMap('nodes'), settings: doc.getMap('form') }
    fillMaps(maps, START())
    expect(readMaps(maps).document).toEqual(START())
  })

  it('lifts nodes whose container is gone and breaks containers out of a loop', () => {
    const doc = new Y.Doc()
    const maps = { nodes: doc.getMap('nodes'), settings: doc.getMap('form') }
    fillMaps(maps, {
      version: 1,
      nodes: [
        { id: 's1', type: 'section', children: [] },
        { id: 's2', type: 'section', children: [] },
        { id: 'f', type: 'input', name: 'f' },
      ],
    })
    // Two people moved each section into the other; a third moved f into one deleted since.
    doc.transact(() => {
      ;(maps.nodes.get('s1') as Y.Map<unknown>).set('$parent', 's2')
      ;(maps.nodes.get('s2') as Y.Map<unknown>).set('$parent', 's1')
      ;(maps.nodes.get('f') as Y.Map<unknown>).set('$parent', 'gone')
    })
    const { document, lifted } = readMaps(maps)
    expect(lifted).toEqual(['s1', 'f'])
    expect(document.nodes).toEqual([
      { id: 's1', type: 'section', children: [{ id: 's2', type: 'section', children: [] }] },
      { id: 'f', type: 'input', name: 'f' },
    ])
  })
})

describe('replaceDocument', () => {
  it('changes only what differs, keeping the other nodes as they were', () => {
    const before = START()
    const next = START()
    ;((next.nodes[1] as FormSectionNode).children[0] as FormFieldNode).label = '手机'
    next.nodes.reverse()
    const tr = new FormBuilderTransaction(before)
    replaceDocument(tr, next)
    expect(tr.steps.map((step) => step.type)).toEqual(['move', 'move', 'update'])
    expect(tr.doc).toEqual(next)
    // The city field did not change, and is the same object.
    expect((tr.doc.nodes[1] as FormSectionNode).children[1]).toBe(
      (before.nodes[1] as FormSectionNode).children[1],
    )
  })
})

describe('collaboration', () => {
  it('fills empty maps from the first builder and brings the second one in line', async () => {
    const { a, b } = await pair()
    expect(b.form.value.nodes).toEqual(a.form.value.nodes)
    expect(b.form.value.columns).toBe(12)
  })

  it('shares new fields, moves and settings', async () => {
    const { a, b } = await pair()
    const id = a.api().add('input', { parent: 'contact', index: 0 })!
    await flush()
    expect((b.form.value.nodes[1] as FormSectionNode).children[0]!.id).toBe(id)

    // Moving a node writes only that node's place.
    const orders = () =>
      Object.fromEntries(
        [...a.doc.getMap('nodes').entries()].map(([key, value]) => [
          key,
          (value as Y.Map<unknown>).get('$order'),
        ]),
      )
    const before = orders()
    b.api().moveTo({ parent: null, index: 0 }, ['note'])
    await flush()
    expect(a.form.value.nodes.map((node) => node.id)).toEqual(['note', 'name', 'contact'])
    const { note: moved, ...others } = orders()
    const { note: was, ...othersBefore } = before
    expect(moved).not.toBe(was)
    expect(others).toEqual(othersBefore)

    const tr = a.api().transaction().updateDocument({ layout: 'horizontal' })
    a.api().dispatch(tr)
    await flush()
    expect(b.form.value.layout).toBe('horizontal')
  })

  it('keeps both changes when two people change different keys of one field', async () => {
    const { a, b } = await pair()
    a.api().dispatch(a.api().transaction().update('phone', { label: '手机' }))
    b.api().dispatch(b.api().transaction().update('phone', { help: '只用来联系你' }))
    await flush()
    expect(phone(a.form.value)).toMatchObject({ label: '手机', help: '只用来联系你' })
    expect(phone(b.form.value)).toEqual(phone(a.form.value))
  })

  it('keeps a field moved into a container another person deleted at the same time', async () => {
    const x = client(START())
    await flush()
    const y = client({ version: 1, nodes: [] })
    Y.applyUpdate(y.doc, Y.encodeStateAsUpdate(x.doc))
    await flush()
    // Neither hears the other until both are done.
    x.api().remove(['contact'])
    y.api().moveTo({ parent: 'contact', index: 0 }, ['note'])
    await flush()
    Y.applyUpdate(x.doc, Y.encodeStateAsUpdate(y.doc))
    Y.applyUpdate(y.doc, Y.encodeStateAsUpdate(x.doc))
    await flush()
    // The section and what it held go; the field moved in stays, at the top.
    expect(new Set(x.form.value.nodes.map((node) => node.id))).toEqual(new Set(['name', 'note']))
    expect(y.form.value).toEqual(x.form.value)
    expect(x.doc.getMap('nodes').has('phone')).toBe(false)
    expect((x.doc.getMap('nodes').get('note') as Y.Map<unknown>).get('$parent')).toBe(null)
  })

  it('undoes only its own changes and selects what was selected before', async () => {
    const { a, b } = await pair()
    a.api().select('phone')
    a.api().dispatch(a.api().transaction().update('phone', { label: '手机' }))
    await flush()
    b.api().dispatch(b.api().transaction().update('phone', { help: '只用来联系你' }))
    await flush()
    a.api().select('note')
    expect(a.api().canUndo).toBe(true)
    a.api().undo()
    await flush()
    expect(phone(a.form.value)).toMatchObject({ label: '手机号', help: '只用来联系你' })
    expect(phone(b.form.value)).toMatchObject({ label: '手机号', help: '只用来联系你' })
    expect(a.selection.value).toEqual(['phone'])
    expect(a.api().canRedo).toBe(true)
    a.api().redo()
    await flush()
    expect(phone(b.form.value)).toMatchObject({ label: '手机' })
  })

  it('marks the nodes others have selected, in their colors', async () => {
    const a = client(START(), { awareness: true, name: '戴兜' })
    await flush()
    const b = client({ version: 1, nodes: [] }, { awareness: true, name: '阿青' })
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc))
    await flush()
    b.api().select('city')
    await flush()
    // Pass the presence across, as a provider would.
    applyAwarenessUpdate(
      a.awareness!,
      encodeAwarenessUpdate(b.awareness!, [b.doc.clientID]),
      'peer',
    )
    await flush()
    const node = a.wrapper.find('.dou-form-builder__node[data-node="city"]')
    expect(node.classes()).toContain('is-marked')
    expect(node.find('.dou-form-builder__mark').text()).toBe('阿青')
    expect(a.wrapper.findAll('.dou-form-builder__node.is-marked')).toHaveLength(1)
  })
})
