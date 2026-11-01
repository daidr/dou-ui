import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import {
  applyCommentAction,
  applySharedCommentAction,
  DouCommentThread,
  readSharedComments,
  type CommentAction,
  type CommentThread,
  type SharedCommentMap,
} from '../../../index'

const dai = { id: 'dai', name: '戴兜' }
const qing = { id: 'qing', name: '阿青' }

const thread = (): CommentThread => ({
  id: 't1',
  comments: [
    { id: 'c1', author: dai, body: '这里的数字对吗？', createdAt: '2026-11-01T08:00:00.000Z' },
    { id: 'c2', author: qing, body: '对的', createdAt: '2026-11-01T08:05:00.000Z' },
  ],
})

/** A plain map standing in for a `Y.Map`. */
function sharedMap(): SharedCommentMap & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>()
  return {
    data,
    get: (key) => data.get(key),
    set: (key, value) => data.set(key, value),
    delete: (key) => void data.delete(key),
    forEach: (callback) => data.forEach((value, key) => callback(value, key)),
    doc: null,
  }
}

describe('applyCommentAction', () => {
  it('applies every kind of change without touching other threads', () => {
    const other: CommentThread = { id: 't0', comments: [] }
    let threads: CommentThread[] = [other, thread()]
    threads = applyCommentAction(threads, {
      type: 'edit',
      threadId: 't1',
      commentId: 'c2',
      body: '没问题',
      editedAt: 'x',
    })
    expect(threads[0]).toBe(other)
    expect(threads[1]!.comments[1]).toMatchObject({ body: '没问题', editedAt: 'x' })
    threads = applyCommentAction(threads, { type: 'resolve', threadId: 't1', by: dai, at: 'y' })
    expect(threads[1]!.resolved).toEqual({ by: dai, at: 'y' })
    threads = applyCommentAction(threads, { type: 'reopen', threadId: 't1' })
    expect('resolved' in threads[1]!).toBe(false)
    threads = applyCommentAction(threads, { type: 'delete', threadId: 't1', commentId: 'c2' })
    expect(threads[1]!.comments).toHaveLength(1)
    // the first comment takes the thread with it
    threads = applyCommentAction(threads, { type: 'delete', threadId: 't1', commentId: 'c1' })
    expect(threads).toEqual([other])
  })
})

describe('shared comments', () => {
  it('reads back what was written, replies in time order', () => {
    const map = sharedMap()
    const [first, second] = thread().comments
    applySharedCommentAction(map, { type: 'create', thread: { id: 't1', comments: [first!] } })
    applySharedCommentAction(map, { type: 'reply', threadId: 't1', comment: second! })
    applySharedCommentAction(map, { type: 'resolve', threadId: 't1', by: qing, at: 'z' })
    expect(readSharedComments(map)).toEqual([{ ...thread(), resolved: { by: qing, at: 'z' } }])
    // a reply to a thread that is gone is dropped
    applySharedCommentAction(map, { type: 'remove', threadId: 't1' })
    applySharedCommentAction(map, { type: 'reply', threadId: 't1', comment: second! })
    expect(map.data.size).toBe(0)
    expect(readSharedComments(map)).toEqual([])
  })
})

describe('DouCommentThread', () => {
  it('starts a thread from the first comment', async () => {
    const wrapper = mount(DouCommentThread, { props: { thread: null, author: dai } })
    const box = wrapper.get('textarea')
    await box.setValue('  第一条  ')
    await box.trigger('keydown', { key: 'Enter' })
    const created = wrapper.emitted('update:thread')![0]![0] as CommentThread
    expect(created.comments).toEqual([expect.objectContaining({ author: dai, body: '第一条' })])
    expect((wrapper.emitted('action')![0]![0] as CommentAction).type).toBe('create')
    expect((box.element as HTMLTextAreaElement).value).toBe('')
  })

  it('replies, resolves and reopens', async () => {
    const wrapper = mount(DouCommentThread, { props: { thread: thread(), author: qing } })
    expect(wrapper.findAll('.dou-comment-thread__body').map((el) => el.text())).toEqual([
      '这里的数字对吗？',
      '对的',
    ])
    await wrapper.get('textarea').setValue('再看看')
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' })
    const replied = wrapper.emitted('update:thread')![0]![0] as CommentThread
    expect(replied.comments.at(-1)).toMatchObject({ author: qing, body: '再看看' })

    await wrapper.get('[aria-label="解决"]').trigger('click')
    const resolved = wrapper.emitted('update:thread')![1]![0] as CommentThread
    expect(resolved.resolved?.by).toEqual(qing)
    await wrapper.setProps({ thread: resolved })
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.get('.dou-comment-thread__status').text()).toContain('阿青 已解决')
    await wrapper.get('.dou-comment-thread__status button').trigger('click')
    expect((wrapper.emitted('action')!.at(-1)![0] as CommentAction).type).toBe('reopen')
  })

  it('shift + enter keeps writing, escape cancels an empty new thread', async () => {
    const wrapper = mount(DouCommentThread, { props: { thread: null, author: dai } })
    const box = wrapper.get('textarea')
    await box.setValue('一行')
    await box.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.emitted('update:thread')).toBeUndefined()
    await box.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('cancel')).toBeUndefined()
    await box.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('readonly shows the comments only', () => {
    const wrapper = mount(DouCommentThread, {
      props: { thread: thread(), author: dai, readonly: true },
    })
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('.dou-comment-thread__actions').exists()).toBe(false)
  })
})
