import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import type { EditorExpose } from '../../editor'
import DouEditor from '../../editor.vue'
import { currentMatch, searchDoc, searchKey } from '../search'
import { p, shape, stateOf } from './helpers'

const blocks = () => [
  p('a', '白板笔放在白板旁'),
  p('b', 'Whiteboard and white'),
  p('c', '上海 2026-11-01'),
]

describe('searching the document', () => {
  it('finds text in each block, by case, whole word or pattern', () => {
    const { doc } = stateOf(blocks())
    const texts = (query: Parameters<typeof searchDoc>[1]) =>
      searchDoc(doc, query).matches.map((m) => doc.textBetween(m.from, m.to))
    expect(texts({ search: '白板' })).toEqual(['白板', '白板'])
    expect(texts({ search: 'white' })).toEqual(['White', 'white'])
    expect(texts({ search: 'white', caseSensitive: true })).toEqual(['white'])
    expect(texts({ search: 'white', wholeWord: true })).toEqual(['white'])
    expect(texts({ search: '\\d+-\\d+', regexp: true })).toEqual(['2026-11'])
    expect(searchDoc(doc, { search: '(', regexp: true }).error).toBeTruthy()
    expect(searchDoc(doc, { search: '白' }, { limit: 1 })).toMatchObject({ capped: true })
  })
})

function setup(props: Record<string, unknown> = {}) {
  const wrapper = mount(DouEditor, {
    attachTo: document.body,
    props: { modelValue: blocks(), ...props },
  })
  const editor = () => wrapper.vm as unknown as EditorExpose
  const inputs = () => wrapper.findAll<HTMLInputElement>('.dou-find-replace__input')
  const status = () => wrapper.find('.dou-find-replace__status').text()
  const surface = () => editor().view!.dom
  const key = (init: KeyboardEventInit) =>
    surface().dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
    )
  return { wrapper, editor, inputs, status, key }
}

describe('the find panel', () => {
  it('opens with Ctrl+F, marks the matches and steps through them', async () => {
    const { wrapper, editor, inputs, status, key } = setup()
    await nextTick()
    key({ key: 'f', ctrlKey: true })
    await nextTick()
    await inputs()[0]!.setValue('白板')
    await nextTick()
    expect(status()).toBe('1/2')
    expect(wrapper.findAll('.dou-editor__match').length).toBe(2)
    expect(wrapper.findAll('.dou-editor__match.is-current').length).toBe(1)
    await inputs()[0]!.trigger('keydown', { key: 'Enter' })
    expect(currentMatch(editor().view!.state)).toBe(1)
    await inputs()[0]!.trigger('keydown', { key: 'Enter' })
    expect(currentMatch(editor().view!.state)).toBe(0)
    await wrapper.find('.dou-find-replace').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.dou-find-replace').exists()).toBe(false)
    expect(wrapper.findAll('.dou-editor__match').length).toBe(0)
    wrapper.unmount()
  })

  it('replaces one, then the rest as one step to undo', async () => {
    const { wrapper, editor, inputs } = setup()
    await nextTick()
    editor().openSearch({ search: '白板', replace: '黑板' })
    await nextTick()
    expect(inputs().length).toBe(2)
    await inputs()[1]!.trigger('keydown', { key: 'Enter' })
    expect(shape(editor().getBlocks())[0]).toEqual(['paragraph', '黑板笔放在白板旁'])
    editor().openSearch({ search: 'white', replace: 'black' })
    await nextTick()
    await inputs()[1]!.trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(shape(editor().getBlocks())[1]).toEqual(['paragraph', 'blackboard and black'])
    // one `transaction` event for the whole replacement, marked as one
    const events = wrapper.emitted('transaction') as [{ meta: { origin?: string } }][]
    expect(events.length).toBe(2)
    expect(events[1]![0].meta.origin).toBe('replace')
    expect(editor().undo()).toBe(true)
    expect(shape(editor().getBlocks())[1]).toEqual(['paragraph', 'Whiteboard and white'])
    wrapper.unmount()
  })

  it('fills in groups when replacing a pattern', async () => {
    const { wrapper, editor, inputs } = setup()
    await nextTick()
    editor().openSearch({ search: '(\\d+)-(\\d+)-(\\d+)', regexp: true, replace: '$1年$2月$3日' })
    await nextTick()
    await inputs()[1]!.trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(shape(editor().getBlocks())[2]).toEqual(['paragraph', '上海 2026年11月01日'])
    wrapper.unmount()
  })

  it('takes a selection on one line as the search, and only finds when read-only', async () => {
    const { wrapper, editor, inputs } = setup({ readonly: true })
    await nextTick()
    const view = editor().view!
    const { TextSelection } = await import('prosemirror-state')
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2, 4)))
    editor().openSearch()
    await nextTick()
    expect(inputs().length).toBe(1)
    expect(inputs()[0]!.element.value).toBe('白板')
    expect(searchKey.getState(view.state)!.matches.length).toBe(2)
    expect(editor().closeSearch()).toBe(true)
    wrapper.unmount()
  })

  it('leaves the keys to the browser when searchable is off', async () => {
    const { wrapper, editor, key } = setup({ searchable: false })
    await nextTick()
    expect(key({ key: 'f', ctrlKey: true })).toBe(true)
    expect(editor().openSearch({ search: '白板' })).toBe(false)
    await nextTick()
    expect(wrapper.find('.dou-find-replace').exists()).toBe(false)
    wrapper.unmount()
  })
})
