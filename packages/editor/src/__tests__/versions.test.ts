import { mount } from '@vue/test-utils'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import * as Y from 'yjs'
import { collaboration, fillMap, readMap } from '../collaboration'
import { diffBlocks, diffText } from '../core/diff'
import type { Block, PartialBlock } from '../core/model'
import { historyCommands } from '../core/editor'
import DouEditor from '../editor.vue'
import { attachment } from '../extensions/attachment'
import { editorKit } from '../extensions/editor-kit'
import { embed } from '../extensions/embed'
import type { EditorExpose } from '../editor'

const wrappers: { unmount: () => void }[] = []
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

const block = (id: string, text: string, extra: Partial<Block> = {}): Block => ({
  id,
  type: 'paragraph',
  props: {},
  content: text ? [{ type: 'text', text }] : [],
  children: [],
  ...extra,
})

const v1 = (): Block[] => [
  block('a', '上海站的活动定在周六'),
  block('b', '预算三万元'),
  block('c', '场地待定'),
]
const v2 = (): Block[] => [
  block('a', '上海站的活动改到周日'),
  block('c', '场地待定'),
  block('d', '物料清单下周给出'),
]

describe('diffBlocks', () => {
  it('matches blocks by id and puts removed ones where they were', () => {
    const diff = diffBlocks(v1(), v2())
    expect(diff.changes.map((c) => `${c.type}:${c.id}`)).toEqual([
      'updated:a',
      'removed:b',
      'added:d',
    ])
    expect([diff.added, diff.removed, diff.updated]).toEqual([['d'], ['b'], ['a']])
    // comments alone are not a change
    const commented = v1()
    commented[1]!.content = [{ type: 'text', text: '预算三万元', comments: ['t1'] }]
    expect(diffBlocks(v1(), commented).changes).toEqual([])
  })

  it('compares text character by character', () => {
    expect(diffText('定在周六', '改到周日')).toEqual([
      { type: 'removed', text: '定在' },
      { type: 'added', text: '改到' },
      { type: 'same', text: '周' },
      { type: 'removed', text: '六' },
      { type: 'added', text: '日' },
    ])
    expect(diffText('abc', 'abc')).toEqual([{ type: 'same', text: 'abc' }])
  })
})

/** The blocks as the document `v-model`, `compare` and `restore` take. */
const doc = <B extends PartialBlock>(blocks: B[]) => ({ version: 1 as const, blocks })

function mountEditor(props: Record<string, unknown>) {
  const wrapper = mount(DouEditor, { props, attachTo: document.body })
  wrappers.push(wrapper)
  const exposed = wrapper.vm as unknown as EditorExpose & { view: EditorView }
  return { wrapper, exposed }
}

describe('compare', () => {
  it('shows what changed since an older version, read-only', async () => {
    const { wrapper, exposed } = mountEditor({ modelValue: doc(v2()), compare: doc(v1()) })
    await nextTick()
    const root = wrapper.element
    expect(root.classList.contains('is-comparing')).toBe(true)
    expect(exposed.view.editable).toBe(false)
    expect(root.querySelector('[data-block-id="d"]')!.classList).toContain('dou-editor__diff-added')
    const removedBlock = root.querySelector('.dou-editor__diff-removed-block')!
    expect(removedBlock.textContent).toBe('预算三万元')
    // it stands where it was: before the block that followed it
    expect(removedBlock.nextElementSibling!.getAttribute('data-block-id')).toBe('c')
    const changed = root.querySelector('[data-block-id="a"]')!
    expect([...changed.querySelectorAll('del')].map((el) => el.textContent)).toEqual(['定在', '六'])
    expect(
      [...changed.querySelectorAll('.dou-editor__diff-added-text')].map((el) => el.textContent),
    ).toEqual(['改到', '日'])

    // the changes, one after another
    expect(exposed.nextChange()).toBe(true)
    expect(exposed.nextChange()).toBe(true)
    expect(exposed.nextChange()).toBe(true)
    expect(exposed.nextChange()).toBe(false)
    expect(exposed.previousChange()).toBe(true)

    await wrapper.setProps({ compare: null })
    expect(root.querySelector('.dou-editor__diff-removed-block')).toBeNull()
    expect(exposed.view.editable).toBe(true)
  })
})

const file = (id: string, name: string): Block =>
  block(id, '', {
    type: 'attachment',
    props: { src: `https://example.com/${name}`, name, size: 1024, mime: 'application/pdf' },
  })
const frame = (id: string, caption: string): Block =>
  block(id, '', { type: 'embed', props: { src: 'https://example.com/route.mp4', caption } })

const filesBefore = () => [
  block('a', '上海站的活动定在周六'),
  file('f', '方案.pdf'),
  frame('e', '上海地图'),
  file('g', '预算.xlsx'),
]
const filesAfter = () => [
  block('a', '', { content: [{ type: 'text', text: '上海站的活动定在周六', marks: ['bold'] }] }),
  file('f', '方案二稿.pdf'),
  frame('e', '上海地图'),
  file('h', '物料.zip'),
  frame('k', '会场路线'),
]

describe('compare with files and embeds', () => {
  it('marks changed, added and removed files and embeds, and restores them', async () => {
    const diff = diffBlocks(filesBefore(), filesAfter())
    expect([diff.added, diff.removed, diff.updated]).toEqual([['h', 'k'], ['g'], ['a', 'f']])
    const { wrapper, exposed } = mountEditor({
      modelValue: doc(filesAfter()),
      compare: doc(filesBefore()),
      extensions: [editorKit(), attachment(), embed()],
    })
    await nextTick()
    const root = wrapper.element
    const classes = (id: string) => root.querySelector(`[data-block-id="${id}"]`)!.classList
    expect(classes('f')).toContain('dou-editor__diff-changed')
    expect(classes('e')).not.toContain('dou-editor__diff-changed')
    expect(classes('h')).toContain('dou-editor__diff-added')
    expect(classes('k')).toContain('dou-editor__diff-added')
    // only the formatting changed: the text is the same, the block still shows it changed
    expect(classes('a')).toContain('dou-editor__diff-changed')
    // a removed file reads as its name
    expect(root.querySelector('.dou-editor__diff-removed-block')!.textContent).toBe('预算.xlsx')

    expect(exposed.restore(doc(filesBefore()))).toBe(true)
    await wrapper.setProps({ compare: null })
    expect(diffBlocks(filesBefore(), exposed.getBlocks()).changes).toEqual([])
    expect(exposed.getBlocks().map((b) => [b.id, b.type])).toEqual([
      ['a', 'paragraph'],
      ['f', 'attachment'],
      ['e', 'embed'],
      ['g', 'attachment'],
    ])
  })
})

describe('restore', () => {
  it('replaces the document as one change undo takes back', async () => {
    const { exposed } = mountEditor({ modelValue: doc(v2()) })
    await nextTick()
    expect(exposed.restore(doc(v1()))).toBe(true)
    expect(exposed.getBlocks().map((b) => b.id)).toEqual(['a', 'b', 'c'])
    expect(exposed.getBlocks()[0]!.content).toEqual([
      { type: 'text', text: '上海站的活动定在周六' },
    ])
    expect(exposed.restore(doc(v1()))).toBe(false)
    expect(exposed.run(historyCommands(exposed.view.state).undo)).toBe(true)
    expect(exposed.getBlocks().map((b) => b.id)).toEqual(['a', 'c', 'd'])
  })

  it('reads out the restore, the one change allowed while comparing', async () => {
    const { wrapper, exposed } = mountEditor({ modelValue: doc(v2()), compare: doc(v1()) })
    await nextTick()
    expect(exposed.nextChange()).toBe(true)
    await nextTick()
    await nextTick()
    const live = wrapper.find('.dou-editor__live')
    expect(live.text()).toBe('修改 上海站的活动改到周日')
    expect(exposed.restore(doc(v1()))).toBe(true)
    await nextTick()
    await nextTick()
    expect(live.text()).toBe('已恢复到这个版本')
    // comparing, the other methods change nothing
    expect(exposed.insertBlocks([{ type: 'paragraph' }])).toEqual([])
    expect(exposed.transact((tr) => tr.removeBlocks(['a']))).toBeNull()
    expect(exposed.getBlocks().map((b) => b.id)).toEqual(['a', 'b', 'c'])
    // like them, restore works from code on a read-only editor, as a change with its origin
    await wrapper.setProps({ readonly: true, compare: null })
    expect(exposed.restore(doc(v2()))).toBe(true)
    const event = wrapper.emitted('transaction')!.at(-1)![0] as { meta: { origin?: string } }
    expect(event.meta.origin).toBe('restore')
  })

  it('writes only what differs into a shared document, and reads it back without an editor', async () => {
    const ydoc = new Y.Doc()
    const map = ydoc.getMap('doc')
    fillMap(map, doc(v2()))
    expect(readMap(map).blocks.map((b) => b.id)).toEqual(['a', 'c', 'd'])
    const { exposed } = mountEditor({ extensions: [editorKit(), collaboration({ map })] })
    await nextTick()
    const untouched = map.get('c')
    expect(exposed.restore(doc(v1()))).toBe(true)
    await nextTick()
    expect(readMap(map).blocks.map((b) => b.id)).toEqual(['a', 'b', 'c'])
    expect(readMap(map).blocks[0]!.content).toEqual([
      { type: 'text', text: '上海站的活动定在周六' },
    ])
    // a block that is the same in both is left as it is
    expect(map.get('c')).toBe(untouched)
  })
})
