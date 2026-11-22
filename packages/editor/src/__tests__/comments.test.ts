import { readFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mount } from '@vue/test-utils'
import type { CommentAction, CommentThread } from 'dou-ui'
import { undoDepth } from 'prosemirror-history'
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import * as Y from 'yjs'
import { collaboration, fillMap } from '../collaboration'
import { findBlockById } from '../core/blocks'
import type { CommentAnchor } from '../core/comments'
import { createEditorView, getBlocks } from '../core/editor'
import { resolveEditorExtensions } from '../core/extension'
import { blocksToDoc, docToBlocks, type EditorDocument, type PartialBlock } from '../core/model'
import { defineBlock, type BlockViewProps } from '../define-block'
import type { EditorExpose } from '../editor'
import DouEditor from '../editor.vue'
import { editorKit } from '../extensions/editor-kit'
import { isToggleOpen } from '../extensions/toggle/state'

const dai = { id: 'dai', name: '戴兜' }
const qing = { id: 'qing', name: '阿青' }
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

const wrappers: { unmount: () => void }[] = []
const views: EditorView[] = []
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  for (const view of views.splice(0)) view.destroy()
  document.body.innerHTML = ''
})

/** Selects `text` inside block `id`. */
function select(view: EditorView, id: string, text: string) {
  const info = findBlockById(view.state.doc, id)!
  const start = info.contentPos + 1 + info.content.textContent.indexOf(text)
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, start, start + text.length)),
  )
}

function clickOn(target: Element) {
  const event = new MouseEvent('click', { button: 0 })
  Object.defineProperty(event, 'target', { value: target })
  return event
}

/** Sends an action from the open card, as its buttons would. */
function act(wrapper: ReturnType<typeof mount>, action: CommentAction) {
  wrapper.findComponent({ name: 'DouCommentThread' }).vm.$emit('action', action)
}

const thread = (id: string, body = '看一下', author = dai): CommentThread => ({
  id,
  comments: [{ id: `${id}-1`, author, body, createdAt: '2026-11-01T08:00:00.000Z' }],
})

function mountEditor(props: Record<string, unknown>) {
  const wrapper = mount(DouEditor, { props, attachTo: document.body })
  wrappers.push(wrapper)
  const view = (wrapper.vm as unknown as { view: EditorView }).view
  return { wrapper, view }
}

describe('comment anchors in the document', () => {
  it('reads and writes `comments` on text, overlapping threads included', () => {
    const { schema } = resolveEditorExtensions([editorKit()])
    const blocks: PartialBlock[] = [
      {
        id: 'a',
        content: [
          { type: 'text', text: '第三', comments: ['t1'] },
          { type: 'text', text: '季度', marks: ['bold'], comments: ['t1', 't2'] },
          { type: 'text', text: '收入' },
        ],
      },
    ]
    const doc = blocksToDoc(schema, blocks)
    expect(docToBlocks(doc)[0]!.content).toEqual(blocks[0]!.content)
  })

  it('comments on inline code too', () => {
    const { schema } = resolveEditorExtensions([editorKit()])
    const content = [{ type: 'text' as const, text: 'npm', marks: ['code'], comments: ['t1'] }]
    expect(docToBlocks(blocksToDoc(schema, [{ id: 'a', content }]))[0]!.content).toEqual(content)
  })
})

describe('DouEditor comments', () => {
  it('starts a thread on the selected text', async () => {
    const { wrapper, view } = mountEditor({
      modelValue: [{ id: 'a', content: '第三季度收入' }],
      comments: [],
      author: dai,
    })
    select(view, 'a', '季度')
    expect((wrapper.vm as unknown as { comment: () => boolean }).comment()).toBe(true)
    await nextTick()
    await flush()
    const card = document.querySelector('.dou-editor-comment')!
    expect(card).not.toBeNull()
    expect(view.dom.querySelector('.dou-editor__comment-pending')?.textContent).toBe('季度')
    const box = card.querySelector('textarea')!
    box.value = '数字要核对'
    box.dispatchEvent(new Event('input'))
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flush()

    const [threads] = wrapper.emitted('update:comments')!.at(-1) as [CommentThread[]]
    expect(threads).toHaveLength(1)
    expect(threads[0]!.comments[0]).toMatchObject({ author: dai, body: '数字要核对' })
    const action = wrapper.emitted('commentAction')![0]![0] as CommentAction
    expect(action.type).toBe('create')
    expect(wrapper.emitted('update:activeComment')!.at(-1)).toEqual([threads[0]!.id])
    expect(getBlocks(view)[0]!.content).toEqual([
      { type: 'text', text: '第三' },
      { type: 'text', text: '季度', comments: [threads[0]!.id] },
      { type: 'text', text: '收入' },
    ])
  })

  it('highlights open threads only, the active one stronger', async () => {
    const { wrapper } = mountEditor({
      modelValue: [
        {
          id: 'a',
          content: [
            { type: 'text', text: '一', comments: ['t1'] },
            { type: 'text', text: '二', comments: ['t2'] },
          ],
        },
      ],
      comments: [thread('t1'), { ...thread('t2'), resolved: { by: dai, at: 'x' } }],
      author: dai,
      activeComment: 't1',
    })
    await nextTick()
    const css = wrapper.find('style').text()
    expect(css).toContain('[data-comment=t1]')
    expect(css).not.toContain('t2')
    expect(css).toContain('--dou-editor-comment-bg-active')
  })

  it('a click on highlighted text opens its thread', async () => {
    const { wrapper, view } = mountEditor({
      modelValue: [
        {
          id: 'a',
          content: [
            { type: 'text', text: '收入', comments: ['t1'] },
            { type: 'text', text: '支出' },
          ],
        },
      ],
      comments: [thread('t1')],
      author: qing,
    })
    const info = findBlockById(view.state.doc, 'a')!
    const click = (pos: number) =>
      view.someProp('handleClick', (handler) => handler(view, pos, clickOn(view.dom)))
    click(info.contentPos + 2)
    expect(wrapper.emitted('update:activeComment')!.at(-1)).toEqual(['t1'])
    await wrapper.setProps({ activeComment: 't1' })
    await flush()
    expect(document.querySelector('.dou-editor-comment')?.textContent).toContain('看一下')
    click(info.contentPos + 4)
    expect(wrapper.emitted('update:activeComment')!.at(-1)).toEqual([null])
  })

  it('escape in the editor closes the card; selecting other text does too', async () => {
    const { wrapper, view } = mountEditor({
      modelValue: [
        {
          id: 'a',
          content: [
            { type: 'text', text: '收入', comments: ['t1'] },
            { type: 'text', text: '和支出' },
          ],
        },
      ],
      comments: [thread('t1')],
      author: dai,
    })
    const open = async () => {
      await wrapper.setProps({ activeComment: 't1' })
      await flush()
      expect(document.querySelector('.dou-editor-comment')).not.toBeNull()
    }
    await open()
    view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('update:activeComment')!.at(-1)).toEqual([null])
    await open()
    select(view, 'a', '支出')
    expect(wrapper.emitted('update:activeComment')!.at(-1)).toEqual([null])
  })

  it('the shortcut on commented text opens its thread', async () => {
    const { wrapper, view } = mountEditor({
      modelValue: [{ id: 'a', content: [{ type: 'text', text: '收入', comments: ['t1'] }] }],
      comments: [thread('t1')],
      author: dai,
    })
    const info = findBlockById(view.state.doc, 'a')!
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, info.contentPos + 2)),
    )
    expect((wrapper.vm as unknown as { comment: () => boolean }).comment()).toBe(true)
    expect(wrapper.emitted('update:activeComment')!.at(-1)).toEqual(['t1'])
  })

  it('removing a thread takes its anchor off the text', async () => {
    const { wrapper, view } = mountEditor({
      modelValue: [{ id: 'a', content: [{ type: 'text', text: '收入', comments: ['t1'] }] }],
      comments: [thread('t1')],
      author: dai,
      activeComment: 't1',
    })
    await flush()
    expect(
      (wrapper.vm as unknown as { getCommentAnchors: () => unknown }).getCommentAnchors(),
    ).toEqual({ t1: { block: 'a', text: '收入', from: 2, to: 4 } })
    act(wrapper, { type: 'remove', threadId: 't1' })
    await flush()
    expect(wrapper.emitted('update:comments')!.at(-1)).toEqual([[]])
    expect(getBlocks(view)[0]!.content).toEqual([{ type: 'text', text: '收入' }])
  })

  it('a thread whose text was deleted has no anchor', async () => {
    const { wrapper, view } = mountEditor({
      modelValue: [{ id: 'a', content: [{ type: 'text', text: '收入', comments: ['t1'] }] }],
      comments: [thread('t1')],
      author: dai,
    })
    view.dispatch(view.state.tr.delete(2, 4))
    expect(
      (wrapper.vm as unknown as { getCommentAnchors: () => unknown }).getCommentAnchors(),
    ).toEqual({ t1: null })
  })

  it('a copy pasted elsewhere leaves the thread where it was; cut text takes it along', async () => {
    const { view } = mountEditor({
      modelValue: [
        { id: 'a', content: [{ type: 'text', text: '收入', comments: ['t1'] }] },
        { id: 'b', content: '' },
      ],
      comments: [thread('t1')],
      author: dai,
    })
    const html = '<span data-comment="t1">收入</span>'
    const b = findBlockById(view.state.doc, 'b')!
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, b.contentPos + 1)),
    )
    view.pasteHTML(html)
    expect(getBlocks(view)[1]!.content).toEqual([{ type: 'text', text: '收入' }])
    // the original is gone (cut): the pasted text is the anchor now
    const a = findBlockById(view.state.doc, 'a')!
    view.dispatch(view.state.tr.delete(a.contentPos + 1, a.contentPos + 3))
    const b2 = findBlockById(view.state.doc, 'b')!
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, b2.contentPos + 1)),
    )
    view.pasteHTML(html)
    expect(getBlocks(view)[1]!.content[0]).toEqual({ type: 'text', text: '收入', comments: ['t1'] })
    // threads that aren't there are not brought in
    view.pasteHTML('<span data-comment="other">外来</span>')
    expect(JSON.stringify(getBlocks(view))).not.toContain('other')
  })
})

function client(doc: Y.Doc, author = dai) {
  const kit = [
    editorKit(),
    collaboration({ map: doc.getMap('document'), comments: doc.getMap('comments') }),
  ]
  return mountEditor({ extensions: kit, author })
}

function link(a: Y.Doc, b: Y.Doc) {
  a.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin !== 'relay') Y.applyUpdate(b, update, 'relay')
  })
  b.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin !== 'relay') Y.applyUpdate(a, update, 'relay')
  })
}

/** An editor view on a shared document, without the component. */
function plainClient(doc: Y.Doc) {
  const element = document.createElement('div')
  document.body.append(element)
  const view = createEditorView({
    element,
    kit: resolveEditorExtensions([editorKit(), collaboration({ map: doc.getMap('document') })]),
    placeholder: { text: () => '', heading: () => '', empty: () => '' },
  })
  views.push(view)
  return view
}

/** Puts thread `id` on `text`, as starting a thread does. */
function mark(view: EditorView, text: string, id: string) {
  select(view, 'a', text)
  const { from, to } = view.state.selection
  view.dispatch(view.state.tr.addMark(from, to, view.state.schema.marks.comment!.create({ id })))
}

describe('comments with collaboration', () => {
  it('shares threads and their anchors; undo leaves them', async () => {
    const docA = new Y.Doc()
    fillMap(docA.getMap('document'), { version: 1, blocks: [{ id: 'a', content: '第三季度收入' }] })
    const docB = new Y.Doc()
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))
    link(docA, docB)
    const A = client(docA)
    const B = client(docB, qing)
    await flush()

    // A types, then comments: undo takes back the typing only
    const info = findBlockById(A.view.state.doc, 'a')!
    A.view.dispatch(A.view.state.tr.insertText('！', info.contentPos + 7))
    select(A.view, 'a', '季度')
    ;(A.wrapper.vm as unknown as { comment: () => boolean }).comment()
    await flush()
    const box = document.querySelector<HTMLTextAreaElement>('.dou-editor-comment textarea')!
    box.value = '核对'
    box.dispatchEvent(new Event('input'))
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flush()

    const [threads] = B.wrapper.emitted('update:comments')!.at(-1) as [CommentThread[]]
    expect(threads).toHaveLength(1)
    expect(threads[0]!.comments[0]!.body).toBe('核对')
    const id = threads[0]!.id
    expect(getBlocks(B.view)[0]!.content[1]).toEqual({ type: 'text', text: '季度', comments: [id] })

    // undo on A: the typed "！" goes, the anchor stays
    A.view.someProp('handleKeyDown', (handler) =>
      handler(A.view, new KeyboardEvent('keydown', { key: 'z', ctrlKey: true })),
    )
    await flush()
    expect(getBlocks(B.view)[0]!.content).toEqual([
      { type: 'text', text: '第三' },
      { type: 'text', text: '季度', comments: [id] },
      { type: 'text', text: '收入' },
    ])

    // B replies, then removes the thread: the anchor goes everywhere
    await B.wrapper.setProps({ activeComment: id })
    await flush()
    act(B.wrapper, {
      type: 'reply',
      threadId: id,
      comment: {
        id: 'r1',
        author: qing,
        body: '好',
        createdAt: new Date(Date.now() + 1000).toISOString(),
      },
    })
    await flush()
    const [afterReply] = A.wrapper.emitted('update:comments')!.at(-1) as [CommentThread[]]
    expect(afterReply[0]!.comments.map((comment) => comment.body)).toEqual(['核对', '好'])
    act(B.wrapper, { type: 'remove', threadId: id })
    await flush()
    expect(A.wrapper.emitted('update:comments')!.at(-1)).toEqual([[]])
    expect(JSON.stringify(getBlocks(A.view))).not.toContain(id)
  })

  it('keeps two people commenting on overlapping text apart', async () => {
    const docA = new Y.Doc()
    fillMap(docA.getMap('document'), { version: 1, blocks: [{ id: 'a', content: '第三季度收入' }] })
    const docB = new Y.Doc()
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))
    const viewA = plainClient(docA)
    const viewB = plainClient(docB)
    await flush()
    // offline at the same time
    mark(viewA, '第三季度', 'x')
    mark(viewB, '季度收入', 'y')
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB))
    await flush()
    const expected = [
      { type: 'text', text: '第三', comments: ['x'] },
      { type: 'text', text: '季度', comments: ['x', 'y'] },
      { type: 'text', text: '收入', comments: ['y'] },
    ]
    expect(getBlocks(viewA)[0]!.content).toEqual(expected)
    expect(getBlocks(viewB)[0]!.content).toEqual(expected)
    // one taken off, the other stays
    const type = viewA.state.schema.marks.comment!
    viewA.dispatch(
      viewA.state.tr.removeMark(0, viewA.state.doc.content.size, type.create({ id: 'x' })),
    )
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))
    await flush()
    expect(getBlocks(viewB)[0]!.content).toEqual([
      { type: 'text', text: '第三' },
      { type: 'text', text: '季度收入', comments: ['y'] },
    ])
  })
})

describe('threads inside a block of your own', () => {
  type Card = { id: string; text: string; comments?: string[] }
  const cardsOf = (props: Record<string, unknown>) => (props.cards ?? []) as Card[]
  let viewProps: BlockViewProps | null = null
  const board = defineBlock<string>({
    type: 'cards',
    props: { cards: [] },
    content: 'none',
    component: defineComponent({
      props: ['block', 'selected', 'editable', 'updateProps'],
      setup(props) {
        viewProps = props as unknown as BlockViewProps
        return () => null
      },
    }),
    comments: {
      anchors: (props) =>
        Object.fromEntries(
          cardsOf(props).flatMap((card) =>
            (card.comments ?? []).map((id) => [id, { text: card.text, target: card.id }]),
          ),
        ),
      place(props, id, target) {
        const cards = cardsOf(props)
        if (!cards.some((card) => card.id === target)) return null
        return {
          cards: cards.map((card) =>
            card.id === target ? { ...card, comments: [...(card.comments ?? []), id] } : card,
          ),
        }
      },
      strip: (props, keep) => ({
        cards: cardsOf(props).map((card) => ({
          ...card,
          comments: (card.comments ?? []).filter(keep),
        })),
      }),
    },
  })

  it('lists them, and keeps a change made with `history: false` out of undo', async () => {
    const { wrapper, view } = mountEditor({
      modelValue: {
        version: 1,
        blocks: [
          {
            id: 'k',
            type: 'cards',
            props: {
              cards: [
                { id: 'c1', text: '采购', comments: ['t1'] },
                { id: 'c2', text: '布置' },
              ],
            },
          },
        ],
      },
      comments: [thread('t1')],
      extensions: [editorKit(), board],
    })
    await nextTick()
    const anchors = (
      wrapper.vm as unknown as { getCommentAnchors: () => object }
    ).getCommentAnchors()
    expect(anchors).toEqual({
      t1: expect.objectContaining({ block: 'k', type: 'cards', text: '采购', target: 'c1' }),
    })
    const before = undoDepth(view.state)
    viewProps!.updateProps(
      {
        cards: [
          { id: 'c1', text: '采购', comments: ['t1'] },
          { id: 'c2', text: '布置', comments: ['t2'] },
        ],
      },
      { history: false },
    )
    expect(undoDepth(view.state)).toBe(before)
    expect(cardsOf(findBlockById(view.state.doc, 'k')!.content.attrs)[1]!.comments).toEqual(['t2'])
  })

  it('scrolls to a block comment anchor via scrollToComment', async () => {
    const { wrapper } = mountEditor({
      modelValue: {
        version: 1,
        blocks: [
          {
            id: 'k',
            type: 'cards',
            props: { cards: [{ id: 'c1', text: '采购', comments: ['t1'] }] },
          },
        ],
      },
      comments: [thread('t1')],
      extensions: [editorKit(), board],
    })
    await nextTick()
    const block = (wrapper.element as HTMLElement).querySelector<HTMLElement>(
      '[data-block-id="k"]',
    )!
    const spy = vi.fn<(options?: boolean | ScrollIntoViewOptions) => void>()
    block.scrollIntoView = spy
    const editor = wrapper.vm as unknown as EditorExpose
    expect(editor.scrollToComment('t1')).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({ block: 'center', inline: 'nearest', behavior: 'smooth' })
  })
})

describe('comment-action anchor readiness and scrollToComment', () => {
  it('exposes the new anchor synchronously inside @comment-action on create and drops it on remove', async () => {
    const doc = ref<EditorDocument<PartialBlock>>({
      version: 1,
      blocks: [{ id: 'a', content: '第三季度收入' }],
    })
    const comments = ref<CommentThread[]>([])
    const active = ref<string | null>(null)
    const editor = ref<EditorExpose>()
    const seenOnCreate: Record<string, CommentAnchor | null>[] = []
    const seenOnRemove: Record<string, CommentAnchor | null>[] = []

    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouEditor, {
            ref: editor,
            modelValue: doc.value,
            'onUpdate:modelValue': (next: EditorDocument) => (doc.value = next),
            comments: comments.value,
            'onUpdate:comments': (next: CommentThread[]) => (comments.value = next),
            activeComment: active.value,
            'onUpdate:activeComment': (id: string | null) => (active.value = id),
            onCommentAction: (action: CommentAction) => {
              if (action.type === 'create') seenOnCreate.push(editor.value!.getCommentAnchors())
              if (action.type === 'remove') seenOnRemove.push(editor.value!.getCommentAnchors())
            },
            author: dai,
          }),
      ),
      { attachTo: document.body },
    )
    wrappers.push(wrapper)
    await nextTick()

    const view = editor.value!.view!
    select(view, 'a', '季度')
    expect(editor.value!.comment()).toBe(true)
    await flush()

    const created = thread('c1', '数字要核对')
    act(wrapper, { type: 'create', thread: created })

    // read synchronously during @comment-action before Vue flushes v-model:comments
    expect(seenOnCreate).toHaveLength(1)
    expect(seenOnCreate[0]!.c1).toMatchObject({ block: 'a', text: '季度' })

    await flush()
    act(wrapper, { type: 'remove', threadId: 'c1' })
    expect(seenOnRemove).toHaveLength(1)
    expect(seenOnRemove[0]!.c1).toBeUndefined()
  })

  it('scrolls to commented text, opens collapsed toggles around it, and handles missing anchors', async () => {
    const { wrapper, view } = mountEditor({
      modelValue: {
        version: 1,
        blocks: [
          {
            id: 'p1',
            content: [
              { type: 'text', text: '普通' },
              { type: 'text', text: 'code', marks: ['code'], comments: ['t1'] },
            ],
          },
          {
            id: 'tg',
            type: 'toggle',
            content: '折叠区',
            children: [
              {
                id: 'inside',
                content: [{ type: 'text', text: '隐藏评论', comments: ['t2'] }],
              },
            ],
          },
        ],
      },
      comments: [thread('t1'), thread('t2'), thread('gone')],
      author: dai,
    })
    await nextTick()

    const editor = wrapper.vm as unknown as EditorExpose
    const mark1 = view.dom.querySelector<HTMLElement>('[data-comment="t1"]')!
    const spy1 = vi.fn<(options?: boolean | ScrollIntoViewOptions) => void>()
    mark1.scrollIntoView = spy1
    expect(editor.scrollToComment('t1')).toBe(true)
    expect(spy1).toHaveBeenCalledWith({ block: 'center', inline: 'nearest', behavior: 'smooth' })

    expect(editor.scrollToComment('t1', { block: 'start', behavior: 'instant' })).toBe(true)
    expect(spy1).toHaveBeenLastCalledWith({
      block: 'start',
      inline: 'nearest',
      behavior: 'instant',
    })

    // t2 sits inside a toggle that starts collapsed
    expect(isToggleOpen(view.state, 'tg')).toBe(false)
    const mark2 = view.dom.querySelector<HTMLElement>('[data-comment="t2"]')!
    const spy2 = vi.fn<(options?: boolean | ScrollIntoViewOptions) => void>()
    mark2.scrollIntoView = spy2
    expect(editor.scrollToComment('t2')).toBe(true)
    expect(isToggleOpen(view.state, 'tg')).toBe(true)
    expect(spy2).toHaveBeenCalledTimes(1)

    expect(editor.scrollToComment('gone')).toBe(false)
    expect(editor.scrollToComment('unknown')).toBe(false)
  })

  it('returns false from scrollToComment when comments are disabled', async () => {
    const { wrapper } = mountEditor({
      modelValue: { version: 1, blocks: [{ id: 'a', content: '纯文本' }] },
    })
    await nextTick()
    const editor = wrapper.vm as unknown as EditorExpose
    expect(editor.scrollToComment('t1')).toBe(false)
  })

  it('ships inline-code comment transparency and auto-column table constraints in style.css', async () => {
    const css = readFileSync(
      resolvePath(dirname(fileURLToPath(import.meta.url)), '../style.css'),
      'utf8',
    )
    expect(css).toContain('--dou-editor-comment-code-bg')
    expect(css).toContain('padding: var(--dou-editor-code-py, 0.1em) 0.3em;')
    expect(css).toContain(':not(pre) > code:has(.dou-editor__comment-pending)')
    expect(css).toContain("col:not([style*='width:'])")
    expect(css).toContain('overflow-wrap: anywhere;')
    expect(css).toContain(':is(td, th):not([data-colwidth], [colspan], .column-resize-dragging)')

    const { wrapper } = mountEditor({
      modelValue: [
        {
          id: 'a',
          content: [
            { type: 'text', text: 'openCode', marks: ['code'], comments: ['t1'] },
            { type: 'text', text: 'resolvedCode', marks: ['code'], comments: ['t2'] },
          ],
        },
      ],
      comments: [thread('t1'), { ...thread('t2'), resolved: { by: dai, at: 'x' } }],
      author: dai,
    })
    await nextTick()
    const highlight = wrapper.find('style').text()
    expect(highlight).toContain('[data-comment=t1]')
    expect(highlight).toContain('--dou-editor-code-py:0')
    expect(highlight).toContain('--dou-editor-code-bg:var(--dou-editor-comment-code-bg)')
    expect(highlight).not.toContain('t2')
  })
})
