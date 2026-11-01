import { mount } from '@vue/test-utils'
import { TextSelection } from 'prosemirror-state'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import DouEditor from '../../editor.vue'
import type { EditorExpose, EditorSelection, EditorTransactionResult } from '../../editor'
import { diffBlocks } from '../changes'
import type { Block, EditorDocument, PartialBlock } from '../model'
import { p, shape } from './helpers'

type Wrapper = ReturnType<typeof mount>
let wrapper: Wrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

async function editor(blocks: PartialBlock[], props: Record<string, unknown> = {}) {
  wrapper = mount(DouEditor, {
    attachTo: document.body,
    props: { modelValue: { version: 1, blocks }, ...props },
  })
  await nextTick()
  return wrapper.vm as unknown as EditorExpose
}

const ids = (blocks: Block[]): unknown[] =>
  blocks.map((block) => (block.children.length ? [block.id, ids(block.children)] : block.id))

describe('insertBlocks', () => {
  it('inserts after the block with the cursor and hands back the ids', async () => {
    const api = await editor([p('a', 'A'), p('b', 'B')])
    api.focusBlock('a')
    const created = api.insertBlocks([{ id: 'x', content: 'X' }, { content: 'Y' }])
    expect(created[0]).toBe('x')
    expect(created).toHaveLength(2)
    expect(shape(api.getBlocks())).toEqual([
      ['paragraph', 'A'],
      ['paragraph', 'X'],
      ['paragraph', 'Y'],
      ['paragraph', 'B'],
    ])
    expect(api.getBlocks()[2]!.id).toBe(created[1])
  })

  it('goes to the end while the editor never had a cursor', async () => {
    const api = await editor([p('a'), p('b'), p('c')])
    expect(api.getSelection()).toEqual({ block: null, blocks: [] })
    api.insertBlocks([{ id: 'x' }])
    expect(ids(api.getBlocks())).toEqual(['a', 'b', 'c', 'x'])
  })

  it('goes before, after or into a block, at an index', async () => {
    const api = await editor([p('a', 'A', [p('a1', 'A1')]), p('b', 'B')])
    api.insertBlocks([{ id: 'x' }], { before: 'b' })
    api.insertBlocks([{ id: 'y' }], { parent: 'a', index: 0 })
    api.insertBlocks([{ id: 'z' }], { parent: 'b' })
    api.insertBlocks([{ id: 'w' }], { parent: null, index: 0 })
    expect(ids(api.getBlocks())).toEqual(['w', ['a', ['y', 'a1']], 'x', ['b', ['z']]])
  })

  it('replaces an id that is already taken, and finds nothing to insert next to', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const api = await editor([p('a', 'A')])
    const [id] = api.insertBlocks([{ id: 'a', content: 'copy' }], { after: 'a' })
    expect(id).not.toBe('a')
    expect(api.insertBlocks([{}], { after: 'missing' })).toEqual([])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"missing"'))
    warn.mockRestore()
  })

  it('is undone in one step, apart from typing before it', async () => {
    const api = await editor([p('a', 'A')])
    api.focusBlock('a')
    api.view!.dispatch(api.view!.state.tr.insertText('1'))
    api.insertBlocks([{ content: 'X' }, { content: 'Y' }])
    api.view!.dispatch(api.view!.state.tr.insertText('2'))
    expect(api.canUndo).toBe(true)
    api.undo()
    expect(shape(api.getBlocks())).toEqual([
      ['paragraph', 'A1'],
      ['paragraph', 'X'],
      ['paragraph', 'Y'],
    ])
    api.undo()
    expect(shape(api.getBlocks())).toEqual([['paragraph', 'A1']])
    expect(api.canRedo).toBe(true)
  })
})

describe('updateBlock', () => {
  it('merges props and keeps the text', async () => {
    const api = await editor([{ id: 'h', type: 'heading', props: { level: 1 }, content: 'Title' }])
    api.updateBlock('h', { props: { level: 2 } })
    expect(api.getBlock('h')).toMatchObject({ type: 'heading', props: { level: 2 } })
    expect(shape(api.getBlocks())).toEqual([['heading', 'Title']])
  })

  it('changes the type, content and children', async () => {
    const api = await editor([p('a', 'A', [p('c', 'child')])])
    api.updateBlock('a', { type: 'checkItem', props: { checked: true } })
    expect(api.getBlock('a')).toMatchObject({ type: 'checkItem', props: { checked: true } })
    api.updateBlock('a', { content: [{ type: 'text', text: 'Bold', marks: ['bold'] }] })
    expect(api.getBlock('a')!.content).toEqual([{ type: 'text', text: 'Bold', marks: ['bold'] }])
    api.updateBlock('a', { children: [{ id: 'n', content: 'new' }] })
    expect(ids(api.getBlocks())).toEqual([['a', ['n']]])
    api.updateBlock('a', { children: [] })
    expect(ids(api.getBlocks())).toEqual(['a'])
  })

  it('turns text into a block without it and back', async () => {
    const api = await editor([p('a', 'some code')])
    api.updateBlock('a', { type: 'codeBlock', props: { language: 'ts' } })
    expect(api.getBlock('a')).toMatchObject({
      type: 'codeBlock',
      props: { language: 'ts' },
      content: [{ type: 'text', text: 'some code' }],
    })
    api.updateBlock('a', { type: 'divider' })
    expect(api.getBlock('a')!.type).toBe('divider')
  })

  it('fills table rows', async () => {
    const api = await editor([{ id: 't', type: 'table', rows: [{ cells: ['a', 'b'] }] }])
    api.updateBlock('t', { rows: [{ cells: ['1', '2'] }, { cells: ['3', '4'] }] })
    const rows = api.getBlock('t')!.rows!
    expect(rows.map((row) => row.cells.map((cell) => cell.content[0]))).toEqual([
      [
        { type: 'text', text: '1' },
        { type: 'text', text: '2' },
      ],
      [
        { type: 'text', text: '3' },
        { type: 'text', text: '4' },
      ],
    ])
  })

  it('returns false for an unknown id', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const api = await editor([p('a')])
    expect(api.updateBlock('nope', { props: { level: 1 } })).toBe(false)
    warn.mockRestore()
  })
})

describe('removeBlocks and moveBlocks', () => {
  it('removes blocks and an emptied group, and keeps one block', async () => {
    const api = await editor([p('a', 'A', [p('a1')]), p('b')])
    api.removeBlocks(['a1'])
    expect(ids(api.getBlocks())).toEqual(['a', 'b'])
    api.removeBlocks(['a', 'b'])
    expect(api.getBlocks()).toHaveLength(1)
    expect(shape(api.getBlocks())).toEqual([['paragraph', '']])
  })

  it('moves blocks in the given order, keeping their ids and children', async () => {
    const api = await editor([p('a', 'A', [p('a1')]), p('b'), p('c')])
    expect(api.moveBlocks(['c', 'a'], { after: 'b' })).toBe(true)
    expect(ids(api.getBlocks())).toEqual(['b', 'c', ['a', ['a1']]])
    api.moveBlocks(['b'], { parent: 'a', index: 0 })
    expect(ids(api.getBlocks())).toEqual(['c', ['a', ['b', 'a1']]])
    // out of its group: the emptied group goes
    api.moveBlocks(['b', 'a1'], { parent: null })
    expect(ids(api.getBlocks())).toEqual(['c', 'a', 'b', 'a1'])
  })

  it('keeps the cursor in a moved block', async () => {
    const api = await editor([p('a', 'Alpha'), p('b', 'Beta'), p('c', 'Gamma')])
    api.focusBlock('c', 'start')
    const { state } = api.view!
    api.view!.dispatch(
      state.tr.setSelection(TextSelection.create(state.doc, state.selection.from + 2)),
    )
    api.moveBlocks(['c'], { before: 'a' })
    expect(api.getSelection().block).toBe('c')
    const { $from } = api.view!.state.selection
    expect($from.parentOffset).toBe(2)
  })

  it('moves a block to the place right after its neighbour', async () => {
    const api = await editor([p('a'), p('b'), p('c')])
    api.moveBlocks(['b'], { after: 'a' })
    expect(ids(api.getBlocks())).toEqual(['a', 'b', 'c'])
    api.moveBlocks(['a'], { before: 'c' })
    expect(ids(api.getBlocks())).toEqual(['b', 'a', 'c'])
  })

  it('refuses to move blocks into themselves', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const api = await editor([p('a', 'A', [p('a1')]), p('b')])
    expect(api.moveBlocks(['a'], { parent: 'a1' })).toBe(false)
    expect(api.moveBlocks(['a'], { after: 'a' })).toBe(false)
    expect(ids(api.getBlocks())).toEqual([['a', ['a1']], 'b'])
    warn.mockRestore()
  })
})

describe('transact', () => {
  it('applies several changes as one undo step and reports them', async () => {
    const api = await editor([p('a', 'A'), p('b', 'B'), p('c', 'C')])
    const results: EditorTransactionResult[] = []
    await wrapper!.setProps({
      onTransaction: (result: EditorTransactionResult) => results.push(result),
    })
    const result = api.transact(
      (tr) => {
        tr.insertBlocks([{ id: 'x', content: 'X' }], { after: 'c' })
        tr.updateBlock('a', { content: 'A!' })
        tr.removeBlocks(['b'])
        tr.moveBlocks(['c'], { parent: null, index: 0 })
      },
      { origin: 'outline' },
    )!
    expect(result.meta.origin).toBe('outline')
    expect(result.meta.history).toBe(true)
    expect(result.changes).toEqual({ added: ['x'], removed: ['b'], updated: ['a'], moved: ['c'] })
    expect(results).toEqual([result])
    expect(ids(api.getBlocks())).toEqual(['c', 'a', 'x'])
    api.undo()
    expect(ids(api.getBlocks())).toEqual(['a', 'b', 'c'])
  })

  it('returns null when nothing changed, and keeps changes out of undo on request', async () => {
    const api = await editor([p('a', 'A')])
    expect(api.transact(() => {})).toBeNull()
    const result = api.transact((tr) => tr.updateBlock('a', { content: 'B' }), { history: false })
    expect(result!.meta.history).toBe(false)
    expect(api.canUndo).toBe(false)
  })

  it('works while read-only', async () => {
    const api = await editor([p('a', 'A')], { readonly: true })
    api.insertBlocks([{ content: 'B' }], { after: 'a' })
    expect(shape(api.getBlocks())).toEqual([
      ['paragraph', 'A'],
      ['paragraph', 'B'],
    ])
  })

  it('names new v-model values external', async () => {
    const api = await editor([p('a', 'A')])
    const results: EditorTransactionResult[] = []
    await wrapper!.setProps({
      onTransaction: (result: EditorTransactionResult) => results.push(result),
    })
    api.setBlocks([p('a', 'A'), p('b', 'B')])
    expect(results[0]).toMatchObject({ meta: { origin: 'external', history: false } })
  })
})

describe('v-model:selection', () => {
  it('follows the cursor from block to block, not within one', async () => {
    const api = await editor([p('a', 'Alpha'), p('b', 'Beta', [p('b1', 'Inner')])])
    const seen: EditorSelection[] = []
    await wrapper!.setProps({
      'onUpdate:selection': (selection: EditorSelection) => seen.push(selection),
    })
    api.focusBlock('b')
    api.focusBlock('b', 'start')
    api.focusBlock('b1')
    expect(seen).toEqual([
      { block: 'b', blocks: ['b'] },
      { block: 'b1', blocks: ['b1'] },
    ])
    expect(api.getSelection()).toEqual({ block: 'b1', blocks: ['b1'] })
  })
})

describe('diffBlocks', () => {
  it('reports the fewest moved siblings', async () => {
    const api = await editor([p('a'), p('b'), p('c'), p('d')])
    const before = api.view!.state.doc
    api.moveBlocks(['a'], { after: 'd' })
    expect(diffBlocks(before, api.view!.state.doc)).toEqual({
      added: [],
      removed: [],
      updated: [],
      moved: ['a'],
    })
  })
})

describe('review follow-ups', () => {
  it('names undo and redo, which undo cannot take back', async () => {
    const api = await editor([p('a', 'A')])
    const results: EditorTransactionResult[] = []
    await wrapper!.setProps({
      onTransaction: (result: EditorTransactionResult) => results.push(result),
    })
    api.insertBlocks([{ content: 'B' }], { after: 'a' })
    api.undo()
    api.redo()
    expect(results.map((result) => [result.meta.origin, result.meta.history])).toEqual([
      [undefined, true],
      ['undo', false],
      ['redo', false],
    ])
  })

  it('hands back the ids it gave blocks without one', async () => {
    wrapper = mount(DouEditor, {
      attachTo: document.body,
      props: { modelValue: { version: 1, blocks: [{ content: 'x' }] } },
    })
    await nextTick()
    const emitted = (wrapper.emitted('update:modelValue')![0]![0] as EditorDocument).blocks
    expect(emitted[0]!.id).toBeTruthy()
    expect(wrapper.emitted('transaction')).toBeUndefined()
  })

  it('takes a selection from v-model:selection', async () => {
    const api = await editor([p('a', 'A'), p('b', 'B'), p('c', 'C')])
    await wrapper!.setProps({ selection: { block: 'b', blocks: ['b'] } })
    expect(api.getSelection()).toEqual({ block: 'b', blocks: ['b'] })
    await wrapper!.setProps({ selection: { block: 'c', blocks: ['a', 'b', 'c'] } })
    expect(api.getSelection().blocks).toEqual(['a', 'b', 'c'])
  })

  it('focuses the editor after focusBlock inside transact', async () => {
    const api = await editor([p('a', 'A')])
    api.transact((tr) => tr.focusBlock('a'))
    expect(api.view!.hasFocus()).toBe(true)
  })

  it('changes nothing when a patch is refused', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const api = await editor([p('a', 'A', [p('c')])])
    expect(api.updateBlock('a', { children: [], rows: [{ cells: ['x'] }] })).toBe(false)
    expect(ids(api.getBlocks())).toEqual([['a', ['c']]])
    expect(api.canUndo).toBe(false)
    warn.mockRestore()
  })

  it('hands back the real selection when one cannot be set', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const api = await editor([p('a', 'A', [p('a1')]), p('c')])
    api.focusBlock('c')
    await wrapper!.setProps({ selection: { block: 'c', blocks: ['a1', 'c'] } })
    const emitted = wrapper!.emitted('update:selection')!.at(-1)![0]
    expect(emitted).toEqual({ block: 'c', blocks: ['c'] })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('refuses rows on a paragraph and text on a divider', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const api = await editor([p('a', 'A'), { id: 'd', type: 'divider' }])
    expect(api.updateBlock('a', { rows: [{ cells: ['x'] }] })).toBe(false)
    expect(api.updateBlock('d', { content: 'x' })).toBe(false)
    warn.mockRestore()
  })
})
