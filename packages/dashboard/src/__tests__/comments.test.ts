import { mount } from '@vue/test-utils'
import { DouCommentThread, type CommentAction, type CommentThread } from 'dou-ui'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  checkDocument,
  DashboardTransaction,
  DouDashboard,
  defineDashboardWidget,
  replaceWidgets,
} from '..'
import type { DashboardDocument, DashboardExpose } from '..'
import { later } from '../../../../test/later'

const widgets = [
  defineDashboardWidget({
    type: 'stat',
    label: '统计数字',
    size: { w: 3, h: 2 },
    defaultProps: { value: 0 },
    component: defineComponent(() => () => h('div', { class: 'stat' })),
  }),
]

const me = { id: 'dai', name: '戴兜' }
const qing = { id: 'qing', name: '阿青' }
const at = '2026-11-05T08:00:00.000Z'

const doc = (): DashboardDocument => ({
  version: 1,
  widgets: [
    {
      id: 'orders',
      type: 'stat',
      title: '今日订单',
      place: { lg: { x: 0, y: 0, w: 3, h: 2 } },
      comments: ['t1', 'done'],
    },
    { id: 'refunds', type: 'stat', title: '退款申请', place: { lg: { x: 3, y: 0, w: 3, h: 2 } } },
  ],
})
const thread = (id: string, body: string, resolved = false): CommentThread => ({
  id,
  comments: [{ id: `${id}-1`, author: qing, body, createdAt: at }],
  ...(resolved ? { resolved: { by: me, at } } : {}),
})

const mounted: { unmount: () => void }[] = []
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

function setup(props: Record<string, unknown> = {}) {
  const model = ref(doc())
  const threads = ref<CommentThread[]>([
    thread('t1', '上海仓今天订单少了一成？'),
    thread('done', '已经核对过', true),
  ])
  const active = ref<string | null>(null)
  const actions: CommentAction[] = []
  const dashboard = ref<DashboardExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouDashboard, {
          ref: dashboard,
          modelValue: model.value,
          'onUpdate:modelValue': (value: DashboardDocument) => (model.value = value),
          comments: threads.value,
          'onUpdate:comments': (value: CommentThread[]) => (threads.value = value),
          activeComment: active.value,
          'onUpdate:activeComment': (value: string | null) => (active.value = value),
          onCommentAction: (action: CommentAction) => actions.push(action),
          widgets,
          editable: true,
          author: me,
          createId: (type: string) => `${type}-${model.value.widgets.length + 1}`,
          ...props,
        }),
    ),
    { attachTo: document.body },
  )
  mounted.push(wrapper)
  return { wrapper, dashboard, model, threads, active, actions }
}

const ticks = async () => {
  for (let i = 0; i < 4; i++) await nextTick()
}
const button = (id: string) => document.querySelector<HTMLElement>(`[data-dou-comment="${id}"]`)

describe('DouDashboard comments', () => {
  it('counts the open threads on a widget, and opens them from its button', async () => {
    const { wrapper, active } = setup()
    await ticks()
    // the resolved one isn't counted
    expect(button('orders')!.getAttribute('aria-label')).toBe('1 条评论')
    expect(button('refunds')!.getAttribute('aria-label')).toBe('评论')
    button('orders')!.click()
    await ticks()
    expect(active.value).toBe('t1')
    expect(button('orders')!.getAttribute('aria-expanded')).toBe('true')
    const card = document.querySelector('.dou-dashboard__comment-card')!
    expect(card.textContent).toContain('上海仓今天订单少了一成？')
    expect(wrapper.findAllComponents(DouCommentThread)).toHaveLength(1)
    // pressed again: closed
    button('orders')!.click()
    await ticks()
    expect(active.value).toBe(null)
  })

  it('starts a thread on a widget, kept on the widget but not in undo', async () => {
    const { wrapper, dashboard, model, threads, actions, active } = setup()
    await ticks()
    expect(dashboard.value!.comment('refunds')).toBe(true)
    await ticks()
    const box = wrapper.findComponent(DouCommentThread)
    expect(box.props('thread')).toBe(null)
    const created: CommentThread = {
      id: 'new',
      comments: [{ id: 'n1', author: me, body: '退款为什么多了？', createdAt: at }],
    }
    box.vm.$emit('action', { type: 'create', thread: created })
    await ticks()
    expect(model.value.widgets[1]!.comments).toEqual(['new'])
    expect(threads.value.map((t) => t.id)).toEqual(['t1', 'done', 'new'])
    expect(actions.map((a) => a.type)).toEqual(['create'])
    expect(active.value).toBe('new')
    expect(dashboard.value!.canUndo).toBe(false)
    expect(dashboard.value!.getCommentAnchors()).toEqual({
      t1: { widget: 'orders' },
      done: { widget: 'orders' },
      new: { widget: 'refunds' },
    })
  })

  it('opens the thread on a widget with one rather than starting another', async () => {
    const { dashboard, active } = setup()
    await ticks()
    expect(dashboard.value!.comment('orders')).toBe(true)
    expect(active.value).toBe('t1')
    expect(dashboard.value!.comment('nowhere')).toBe(false)
  })

  it('takes a removed thread off its widget', async () => {
    const { wrapper, model, threads } = setup()
    await ticks()
    button('orders')!.click()
    await ticks()
    wrapper.findComponent(DouCommentThread).vm.$emit('action', { type: 'remove', threadId: 't1' })
    await ticks()
    expect(model.value.widgets[0]!.comments).toEqual(['done'])
    expect(threads.value.map((t) => t.id)).toEqual(['done'])
  })

  it('opens a thread set from outside, also a resolved one', async () => {
    const { active } = setup()
    await ticks()
    active.value = 'done'
    await ticks()
    const card = document.querySelector('.dou-dashboard__comment-card')!
    expect(card.textContent).toContain('已经核对过')
  })

  it('still takes comments while not editable', async () => {
    const { wrapper, dashboard, model } = setup({ editable: false })
    await ticks()
    expect(dashboard.value!.comment('refunds')).toBe(true)
    await ticks()
    wrapper.findComponent(DouCommentThread).vm.$emit('action', {
      type: 'create',
      thread: { id: 'r', comments: [{ id: 'r1', author: me, body: '审阅意见', createdAt: at }] },
    })
    await ticks()
    expect(model.value.widgets[1]!.comments).toEqual(['r'])
  })

  it('reads threads without an author, and has no comments without the prop', async () => {
    const reader = setup({ author: undefined })
    await ticks()
    expect(reader.dashboard.value!.comment('refunds')).toBe(false)
    // nothing to read on refunds: no button there
    expect(button('orders')).not.toBe(null)
    expect(button('refunds')).toBe(null)
    reader.wrapper.unmount()
    mounted.length = 0
    const none = setup({ comments: undefined })
    await ticks()
    expect(none.dashboard.value!.comment('orders')).toBe(false)
    expect(button('orders')).toBe(null)
  })

  it('leaves the threads behind when a widget is duplicated', async () => {
    const { dashboard, model } = setup()
    await ticks()
    const copy = dashboard.value!.duplicateWidget('orders')
    await ticks()
    expect(model.value.widgets.find((w) => w.id === copy)!.comments).toBeUndefined()
    expect(model.value.widgets[0]!.comments).toEqual(['t1', 'done'])
  })

  it('keeps the threads of a removed widget, without a place', async () => {
    const { dashboard } = setup()
    await ticks()
    dashboard.value!.removeWidget('orders')
    await ticks()
    expect(dashboard.value!.getCommentAnchors()).toEqual({ t1: null, done: null })
    dashboard.value!.undo()
    await ticks()
    expect(dashboard.value!.getCommentAnchors().t1).toEqual({ widget: 'orders' })
  })

  it('opens the comments of the widget holding the focus with mod+alt+m', async () => {
    const { active } = setup({ editable: false })
    await ticks()
    const inside = document.querySelector<HTMLElement>('[data-grid-id="orders"] .stat')!
    const event = new KeyboardEvent('keydown', {
      key: 'm',
      code: 'KeyM',
      ctrlKey: true,
      altKey: true,
      bubbles: true,
      cancelable: true,
    })
    later()
    inside.dispatchEvent(event)
    await ticks()
    expect(active.value).toBe('t1')
    expect(event.defaultPrevented).toBe(true)
  })

  it('keeps a thread on a widget whose adding is undone and redone', async () => {
    const { wrapper, dashboard, model } = setup()
    await ticks()
    const id = dashboard.value!.addWidget('stat')!
    await ticks()
    expect(dashboard.value!.comment(id)).toBe(true)
    await ticks()
    wrapper.findComponent(DouCommentThread).vm.$emit('action', {
      type: 'create',
      thread: { id: 'n', comments: [{ id: 'n1', author: me, body: '新格子', createdAt: at }] },
    })
    await ticks()
    dashboard.value!.undo()
    await ticks()
    expect(model.value.widgets.some((w) => w.id === id)).toBe(false)
    dashboard.value!.redo()
    await ticks()
    expect(model.value.widgets.find((w) => w.id === id)!.comments).toEqual(['n'])
  })

  it('puts the focus in the reply box from the keyboard, not from a click', async () => {
    const { active } = setup()
    await ticks()
    button('orders')!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    await ticks()
    expect(active.value).toBe('t1')
    const card = document.querySelector('.dou-dashboard__comment-card')!
    expect(card.contains(document.activeElement)).toBe(false)
    button('orders')!.click()
    await ticks()
    button('orders')!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    await ticks()
    await new Promise((resolve) => setTimeout(resolve))
    await ticks()
    const again = document.querySelector('.dou-dashboard__comment-card')!
    expect(again.contains(document.activeElement)).toBe(true)
  })

  it('comments in the full screen view, by its button and the shortcut', async () => {
    const { dashboard, active, actions } = setup({ editable: false })
    await ticks()
    dashboard.value!.openFullscreen('orders')
    await ticks()
    const inside = document.querySelector<HTMLElement>(
      '.dou-dashboard__fullscreen [data-dou-comment="orders"]',
    )!
    expect(inside.getAttribute('aria-label')).toBe('1 条评论')
    const event = new KeyboardEvent('keydown', {
      key: 'm',
      code: 'KeyM',
      ctrlKey: true,
      altKey: true,
      bubbles: true,
      cancelable: true,
    })
    // typing in a field, the keys are the field's (Ctrl+Alt types characters on some layouts)
    const field = document.createElement('input')
    inside.closest('.dou-dashboard__fullscreen')!.append(field)
    const typed = new KeyboardEvent('keydown', {
      key: 'm',
      code: 'KeyM',
      ctrlKey: true,
      altKey: true,
      bubbles: true,
      cancelable: true,
    })
    later()
    field.dispatchEvent(typed)
    await ticks()
    expect(active.value).toBeNull()
    expect(typed.defaultPrevented).toBe(false)
    field.remove()
    // just opened, the focus is on the dialog itself: the shortcut works from there too
    const panel = inside.closest<HTMLElement>('[role="dialog"]')!
    later()
    panel.dispatchEvent(event)
    await ticks()
    expect(active.value).toBe('t1')
    expect(event.defaultPrevented).toBe(true)
    // the card is in the dialog, which keeps the focus to itself: a reply goes in and is sent
    await new Promise((resolve) => setTimeout(resolve))
    await ticks()
    const card = document.querySelector('.dou-dashboard__fullscreen .dou-dashboard__comment-card')!
    const box = card.querySelector('textarea')!
    expect(document.activeElement).toBe(box)
    box.value = '看过了'
    box.dispatchEvent(new Event('input', { bubbles: true }))
    await ticks()
    card.querySelector<HTMLButtonElement>('.dou-button--primary')!.click()
    await ticks()
    expect(actions.at(-1)).toMatchObject({ type: 'reply', threadId: 't1' })
  })
})

describe('replaceWidgets and checkDocument with comments', () => {
  it('keeps the threads on a widget that stays, unless asked not to', () => {
    const now = doc()
    const defaults: DashboardDocument = {
      version: 1,
      widgets: now.widgets.map((widget) => ({ ...widget, comments: undefined, title: '默认' })),
    }
    const kept = replaceWidgets(new DashboardTransaction(now), defaults).doc
    expect(kept.widgets[0]!.comments).toEqual(['t1', 'done'])
    expect(kept.widgets[0]!.title).toBe('默认')
    const exact = replaceWidgets(new DashboardTransaction(now), defaults, { keepComments: false })
    expect(exact.doc.widgets[0]!.comments).toBeUndefined()
  })

  it('reports comments that are not a list of thread ids', () => {
    const bad = doc()
    ;(bad.widgets[1] as { comments?: unknown }).comments = 'orders-drop'
    expect(checkDocument(bad).map((p) => [p.code, p.path])).toEqual([
      ['bad-comments', 'widgets[1].comments'],
    ])
    expect(checkDocument(doc())).toEqual([])
  })
})
