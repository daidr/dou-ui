import { mount } from '@vue/test-utils'
import type { CommentAction, CommentThread } from 'dou-ui'
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import * as Y from 'yjs'
import { collaboration, fillMap } from '../collaboration'
import { findBlockById } from '../core/blocks'
import { createEditorView, getBlocks } from '../core/editor'
import { resolveEditorExtensions } from '../core/extension'
import { blocksToDoc, docToBlocks, type PartialBlock } from '../core/model'
import DouEditor from '../editor.vue'
import { editorKit } from '../extensions/editor-kit'

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
    const action = wrapper.emitted('comment')![0]![0] as CommentAction
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
    fillMap(docA.getMap('document'), [{ id: 'a', content: '第三季度收入' }])
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
    fillMap(docA.getMap('document'), [{ id: 'a', content: '第三季度收入' }])
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
