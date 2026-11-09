import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'
import {
  applySteps,
  DashboardTransaction,
  DouDashboard,
  defineDashboardWidget,
  replaceWidgets,
  useDashboardWidget,
} from '..'
import type { DashboardDocument, DashboardExpose, DashboardWidget } from '..'
import { collaboration, fillMap, readMap, updateMap } from '../collaboration'
import { later } from '../../../../test/later'

const Stat = defineComponent({
  setup() {
    const { props } = useDashboardWidget<{ value: number }>()
    return () => h('span', { class: 'stat' }, String(props.value.value))
  },
})

const widgets = [
  defineDashboardWidget({
    type: 'stat',
    label: '统计数字',
    size: { w: 3, h: 2 },
    defaultProps: { value: 0 },
    component: Stat,
  }),
]

const start = (): DashboardDocument => ({
  version: 1,
  widgets: [
    {
      id: 'a',
      type: 'stat',
      title: '订单',
      props: { value: 1 },
      place: { lg: { x: 0, y: 0, w: 3, h: 2 } },
    },
    { id: 'b', type: 'stat', props: { value: 2 }, place: { lg: { x: 3, y: 0, w: 3, h: 2 } } },
  ],
})

/** Two Y.Docs that pass each update to the other at once, unless `paused`. */
function pair() {
  const docs = [new Y.Doc(), new Y.Doc()] as const
  const held: (() => void)[] = []
  const state = { paused: false }
  for (const from of docs)
    for (const to of docs)
      if (from !== to)
        from.on('update', (update: Uint8Array, origin: unknown) => {
          if (origin === 'remote') return
          const send = () => Y.applyUpdate(to, update, 'remote')
          if (state.paused) held.push(send)
          else send()
        })
  return {
    docs,
    pause: () => (state.paused = true),
    resume: () => {
      state.paused = false
      for (const send of held.splice(0)) send()
    },
  }
}

async function mountClient(
  doc: Y.Doc,
  extra: Parameters<typeof collaboration>[0] extends infer O ? Partial<O> : never = {},
) {
  const model = ref<DashboardDocument>({ version: 1, widgets: [] })
  // the shared document reaches v-model while the dashboard is set up
  let wrapper: ReturnType<typeof mount> | undefined
  wrapper = mount(DouDashboard, {
    attachTo: document.body,
    props: {
      modelValue: model.value,
      'onUpdate:modelValue': (next: DashboardDocument) => {
        model.value = next
        void wrapper?.setProps({ modelValue: next })
      },
      widgets,
      editable: true,
      collaboration: collaboration({ widgets: doc.getMap('widgets'), ...extra }),
    },
  })
  await wrapper.setProps({ modelValue: model.value })
  const api = wrapper.vm as unknown as DashboardExpose
  return { wrapper, model, api }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('replaceWidgets', () => {
  it('adds, removes, updates and reorders with the fewest steps, keeping unchanged widgets', () => {
    const before = start()
    const c = { id: 'c', type: 'stat', place: {} }
    const next: DashboardDocument = {
      version: 1,
      widgets: [{ ...before.widgets[1]!, title: '金额' }, c, before.widgets[0]!],
    }
    const tr = replaceWidgets(new DashboardTransaction(before), next)
    expect(tr.doc.widgets.map((w) => w.id)).toEqual(['b', 'c', 'a'])
    expect(tr.doc.widgets[1]).toBe(c)
    expect(tr.doc.widgets[2]).toBe(before.widgets[0])
    expect(tr.doc.widgets[0]!.title).toBe('金额')
    // undoing it gives the document back
    expect(applySteps(tr.doc, tr.inverse).doc).toEqual(before)
  })

  it('treats a widget whose type changed as a new one, and leaves an equal document alone', () => {
    const before = start()
    const next = cloneDoc(before)
    next.widgets[0]!.type = 'chart'
    const tr = replaceWidgets(new DashboardTransaction(before), next)
    expect(tr.steps.map((step) => step.type)).toEqual(['remove', 'add'])
    expect(replaceWidgets(new DashboardTransaction(before), cloneDoc(before)).changed).toBe(false)
  })
})

const cloneDoc = (doc: DashboardDocument): DashboardDocument => JSON.parse(JSON.stringify(doc))

describe('fillMap and readMap', () => {
  it('give back the same dashboard, in its order', () => {
    const doc = new Y.Doc()
    const map = doc.getMap('widgets')
    const dashboard = start()
    dashboard.widgets.reverse()
    fillMap(map, dashboard)
    expect(readMap(map)).toEqual(dashboard)
  })
})

const plain = (id: string) => ({ id, type: 'stat', place: {} })
const shared = () => {
  const doc = new Y.Doc()
  const map = doc.getMap('widgets')
  fillMap(map, start())
  return { doc, map }
}
const ids = (map: Y.Map<unknown>) => readMap(map).widgets.map((widget) => widget.id)
const widgetIn = (map: Y.Map<unknown>, id: string) =>
  readMap(map).widgets.find((item) => item.id === id)

describe('updateMap', () => {
  it('writes only what changed from base, keeping what others changed meanwhile', () => {
    const { map } = shared()
    const base = readMap(map)
    // meanwhile someone renames a, moves b on a narrow breakpoint and adds d at the end
    const peer = cloneDoc(base)
    peer.widgets[0]!.title = '新订单'
    peer.widgets[1]!.place.sm = { x: 0, y: 2, w: 6, h: 2 }
    peer.widgets.push({ id: 'd', type: 'stat', place: {} })
    updateMap(map, peer, { base })
    // the program changes a's settings, moves b on the wide breakpoint and adds c after a
    const next = cloneDoc(base)
    next.widgets[0]!.props = { value: 10 }
    next.widgets[1]!.place.lg = { x: 6, y: 0, w: 3, h: 2 }
    next.widgets.splice(1, 0, { id: 'c', type: 'stat', title: '金额', place: {} })
    updateMap(map, next, { base })

    expect(ids(map)).toEqual(['a', 'c', 'b', 'd'])
    expect(widgetIn(map, 'a')).toMatchObject({ title: '新订单', props: { value: 10 } })
    expect(widgetIn(map, 'b')!.place).toEqual({
      lg: { x: 6, y: 0, w: 3, h: 2 },
      sm: { x: 0, y: 2, w: 6, h: 2 },
    })
    expect(widgetIn(map, 'c')).toMatchObject({ title: '金额' })
  })

  it('keeps a widget removed meanwhile removed, and removes what base had and next has not', () => {
    const { map } = shared()
    const base = readMap(map)
    map.delete('a')
    const next = cloneDoc(base)
    next.widgets[0]!.title = '改过'
    next.widgets.pop()
    updateMap(map, next, { base })
    expect(ids(map)).toEqual([])
  })

  it('moves only the widgets the new version moved, and keeps unchanged ones as they are', () => {
    const { map } = shared()
    const base = readMap(map)
    // meanwhile c is added at the top
    updateMap(map, {
      version: 1,
      widgets: [{ id: 'c', type: 'stat', place: {} }, ...base.widgets],
    })
    const a = map.get('a') as Y.Map<unknown>
    const next = { version: 1 as const, widgets: [base.widgets[1]!, base.widgets[0]!] }
    updateMap(map, next, { base })
    expect(ids(map)).toEqual(['c', 'b', 'a'])
    // the same map: the widget wasn't written anew
    expect(map.get('a')).toBe(a)
    // nothing changed: nothing is written
    const updates: unknown[] = []
    map.doc!.on('update', (update) => updates.push(update))
    updateMap(map, readMap(map), { base: readMap(map) })
    updateMap(map, readMap(map))
    expect(updates).toEqual([])
  })

  it('doesn’t take objects with their keys in another order as changed', () => {
    const { map } = shared()
    const base = readMap(map)
    // meanwhile someone moves a and changes its settings
    const peer = cloneDoc(base)
    peer.widgets[0]!.place.lg = { x: 6, y: 0, w: 3, h: 2 }
    peer.widgets[0]!.props = { value: 2, unit: '件' }
    updateMap(map, peer, { base })
    // the program only renames a, writing its place and settings with the keys in another order
    const next = cloneDoc(base)
    next.widgets[0]!.title = '新订单'
    next.widgets[0]!.place.lg = { w: 3, h: 2, x: 0, y: 0 }
    next.widgets[0]!.props = { value: 1 }
    // a key set to undefined is no key at all, as in JSON
    const read = cloneDoc(base)
    read.widgets[0]!.props = { value: 1, extra: undefined }
    updateMap(map, next, { base: read })
    expect(widgetIn(map, 'a')).toMatchObject({
      title: '新订单',
      props: { value: 2, unit: '件' },
      place: { lg: { x: 6, y: 0, w: 3, h: 2 } },
    })
  })

  it('puts widgets added after the last one that stays at the end', () => {
    const doc = new Y.Doc()
    const map = doc.getMap('widgets')
    fillMap(map, { version: 1, widgets: [plain('a'), plain('b'), plain('c')] })
    const base = readMap(map)
    // meanwhile c goes to the top
    updateMap(map, { version: 1, widgets: [plain('c'), plain('a'), plain('b')] })
    updateMap(
      map,
      { version: 1, widgets: [plain('a'), plain('b'), plain('x'), plain('c'), plain('y')] },
      { base },
    )
    expect(ids(map)).toEqual(['c', 'a', 'b', 'x', 'y'])
  })

  it('warns about a version it can’t write, and skips widgets without a type or with a taken id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { map } = shared()
      const base = readMap(map)
      base.widgets[0]!.title = '原地改'
      updateMap(map, base, { base })
      expect(widgetIn(map, 'a')!.title).toBe('订单')
      expect(warn.mock.calls[0]![0]).toContain('structuredClone')

      const next = cloneDoc(start())
      next.widgets.push({ id: 'n', place: {} } as unknown as DashboardWidget, {
        ...next.widgets[1]!,
        title: '重复',
      })
      updateMap(map, next, { base: start() })
      expect(ids(map)).toEqual(['a', 'b'])
      expect(map.has('n')).toBe(false)
      expect(widgetIn(map, 'b')!.title).toBeUndefined()
      expect(warn.mock.calls.map((call) => String(call[0]))).toEqual([
        expect.stringContaining('structuredClone'),
        expect.stringContaining('"n"'),
        expect.stringContaining('second widget "b"'),
      ])
    } finally {
      warn.mockRestore()
    }
  })

  it('warns about widgets of base changed in place, but not about ones handed on unchanged', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { map } = shared()
      const base = readMap(map)
      // unchanged widgets of base handed on as they are, though others changed them meanwhile: fine
      ;(map.get('a') as Y.Map<unknown>).set('title', '别人改的')
      updateMap(map, { ...base, widgets: [...base.widgets, plain('c')] }, { base })
      expect(warn).not.toHaveBeenCalled()
      expect(widgetIn(map, 'a')!.title).toBe('别人改的')
      const again = readMap(map)
      updateMap(
        map,
        {
          ...again,
          widgets: again.widgets.map((widget) => {
            widget.title = '原地改'
            return widget
          }),
        },
        { base: again },
      )
      expect(widgetIn(map, 'a')!.title).toBe('别人改的')
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]![0]).toContain('"a"')
    } finally {
      warn.mockRestore()
    }
  })

  it('needs a map in a document', () => {
    expect(() => updateMap(new Y.Map(), start())).toThrow(
      '[@dou-ui/dashboard] updateMap needs a map of a Y.Doc',
    )
  })

  it('without base, makes the map match the new version', () => {
    const { map } = shared()
    const next: DashboardDocument = { version: 1, widgets: [start().widgets[1]!] }
    map.set('x', new Y.Map(Object.entries({ type: 'stat', $order: 'z' })))
    updateMap(map, next)
    expect(readMap(map)).toEqual({ version: 1, widgets: [start().widgets[1]] })
  })

  it('writes in one transaction from the given origin', () => {
    const doc = new Y.Doc()
    const map = doc.getMap('widgets')
    const origins: unknown[] = []
    doc.on('afterTransaction', (tr: Y.Transaction) => origins.push(tr.origin))
    fillMap(map, start(), { origin: 'server' })
    const next = cloneDoc(start())
    next.widgets[0]!.title = '金额'
    updateMap(map, next, { base: start(), origin: 'ai' })
    expect(origins).toEqual(['server', 'ai'])
  })

  it('shows up on an open dashboard as it is written', async () => {
    const { docs } = pair()
    fillMap(docs[0].getMap('widgets'), start())
    const client = await mountClient(docs[1])
    const base = readMap(docs[0].getMap('widgets'))
    const next = cloneDoc(base)
    next.widgets.push({ id: 'c', type: 'stat', props: { value: 7 }, place: {} })
    updateMap(docs[0].getMap('widgets'), next, { base, origin: 'ai' })
    await nextTick()
    expect(client.model.value.widgets.map((w) => w.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('collaboration', () => {
  it('starts from the shared document and shares changes both ways', async () => {
    const { docs } = pair()
    fillMap(docs[0].getMap('widgets'), start())
    const one = await mountClient(docs[0])
    const two = await mountClient(docs[1])
    await nextTick()
    expect(two.model.value).toEqual(start())

    one.api.dispatch(one.api.transaction().update('a', { title: '本周订单' }))
    await nextTick()
    expect(two.model.value.widgets[0]!.title).toBe('本周订单')

    two.api.addWidget('stat', { title: '新格子' })
    await nextTick()
    expect(one.model.value.widgets.map((w) => w.title)).toEqual(['本周订单', undefined, '新格子'])

    two.api.removeWidget('b')
    await nextTick()
    expect(one.model.value.widgets.map((w) => w.id)).not.toContain('b')
  })

  it('keeps both of two changes made at once to different keys and breakpoints', async () => {
    const link = pair()
    fillMap(link.docs[0].getMap('widgets'), start())
    const one = await mountClient(link.docs[0])
    const two = await mountClient(link.docs[1])
    await nextTick()
    link.pause()
    one.api.dispatch(
      one.api
        .transaction()
        .update('a', { title: '订单数', place: { lg: { x: 6, y: 0, w: 3, h: 2 } } }),
    )
    const a = two.model.value.widgets[0]!
    two.api.dispatch(
      two.api.transaction().update('a', {
        props: { value: 9 },
        place: { ...a.place, md: { x: 0, y: 4, w: 6, h: 2 } },
      }),
    )
    link.resume()
    await nextTick()
    for (const client of [one, two]) {
      const widget = client.model.value.widgets[0]!
      expect(widget.title).toBe('订单数')
      expect(widget.props).toEqual({ value: 9 })
      expect(widget.place).toEqual({
        lg: { x: 6, y: 0, w: 3, h: 2 },
        md: { x: 0, y: 4, w: 6, h: 2 },
      })
    }
    expect(one.model.value).toEqual(two.model.value)
  })

  it('undoes only this person’s own changes', async () => {
    const { docs } = pair()
    fillMap(docs[0].getMap('widgets'), start())
    const one = await mountClient(docs[0])
    const two = await mountClient(docs[1])
    await nextTick()
    expect(one.api.canUndo).toBe(false)
    one.api.dispatch(one.api.transaction().update('a', { title: '一' }))
    two.api.dispatch(two.api.transaction().update('b', { title: '二' }))
    await nextTick()
    expect(one.api.canUndo).toBe(true)
    expect(one.api.undo()).toBe(true)
    await nextTick()
    for (const client of [one, two]) {
      expect(client.model.value.widgets.map((w) => w.title)).toEqual(['订单', '二'])
    }
    expect(one.api.canRedo).toBe(true)
    one.api.redo()
    await nextTick()
    expect(two.model.value.widgets[0]!.title).toBe('一')
  })

  it('holds changes from others while a widget is dragged here', async () => {
    const { docs } = pair()
    fillMap(docs[0].getMap('widgets'), start())
    const one = await mountClient(docs[0])
    const two = await mountClient(docs[1])
    await nextTick()
    const grid = one.wrapper.findComponent({ name: 'DouGridLayout' })
    grid.vm.$emit('dragStart', { id: 'a', kind: 'move' })
    two.api.dispatch(two.api.transaction().update('b', { title: '别人改的' }))
    await nextTick()
    expect(one.model.value.widgets[1]!.title).toBeUndefined()
    grid.vm.$emit('dragEnd', { id: 'a', kind: 'move', cancelled: false })
    await new Promise((resolve) => setTimeout(resolve))
    expect(one.model.value.widgets[1]!.title).toBe('别人改的')
  })

  it('shows which widget the others are at, and what they do there', async () => {
    const { docs } = pair()
    fillMap(docs[0].getMap('widgets'), start())
    const awareness = [new Awareness(docs[0]), new Awareness(docs[1])] as const
    // pass awareness both ways, as a server would
    for (const [from, to] of [awareness, [awareness[1], awareness[0]]] as const)
      from.on(
        'update',
        ({ added, updated, removed }: Record<string, number[]>, origin: unknown) => {
          if (origin === 'remote') return
          const update = encodeAwarenessUpdate(from, [...added!, ...updated!, ...removed!])
          applyAwarenessUpdate(to, update, 'remote')
        },
      )
    const one = await mountClient(docs[0], {
      awareness: awareness[0],
      user: { name: '戴兜', color: 'rgb(0, 0, 255)' },
    })
    await mountClient(docs[1], {
      awareness: awareness[1],
      user: { name: '阿青', color: 'rgb(255, 0, 0)' },
    })
    awareness[1].setLocalStateField('dashboard', { widget: 'b', action: 'move' })
    await nextTick()
    const peers = one.wrapper.findAll('.dou-dashboard__peer')
    expect(peers.map((el) => el.text())).toEqual(['阿青 正在移动'])
    // a name over a widget they only selected fades; one for an action stays
    expect(peers[0]!.classes()).toContain('is-move')
    expect(one.wrapper.findAll('.dou-dashboard__widget.has-peers')).toHaveLength(1)

    // focusing a widget here shares it
    later()
    one.wrapper
      .find('[data-grid-id="a"]')
      .element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await nextTick()
    expect(awareness[0].getLocalState()?.dashboard).toEqual({ widget: 'a', action: 'focus' })
    expect(awareness[1].getStates().get(awareness[0].clientID)?.dashboard).toEqual({
      widget: 'a',
      action: 'focus',
    })
    for (const each of awareness) each.destroy()
  })
  it('warns when a new collaboration keeps being handed in, e.g. made in the template', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const doc = new Y.Doc()
    const { wrapper } = await mountClient(doc)
    for (let i = 0; i < 4; i++)
      await wrapper.setProps({ collaboration: collaboration({ widgets: doc.getMap('widgets') }) })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('collaboration keeps being replaced'))
    warn.mockRestore()
  })
})
