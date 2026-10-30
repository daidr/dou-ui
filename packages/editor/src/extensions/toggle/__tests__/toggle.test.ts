import { mount } from '@vue/test-utils'
import { DOMParser } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { findBlockById } from '../../../core/blocks'
import { createEditorView } from '../../../core/editor'
import { resolveExtensions } from '../../../core/extension'
import { docToBlocks, type PartialBlock } from '../../../core/model'
import { cursor, shapeOf } from '../../../core/__tests__/helpers'
import DouEditor from '../../../editor.vue'
import { starterKit } from '../../starter-kit'
import { flipToggle, isToggleOpen } from '../state'

let view: EditorView | undefined

afterEach(() => {
  view?.destroy()
  view = undefined
})

function create(blocks: PartialBlock[]) {
  const element = document.createElement('div')
  document.body.append(element)
  view = createEditorView({
    element,
    kit: resolveExtensions([starterKit()]),
    blocks,
    placeholder: { text: () => '', heading: () => '', empty: () => '' },
  })
  return view
}

/** Put the cursor at the end of a block's text. */
function endOf(target: EditorView, id: string) {
  const info = findBlockById(target.state.doc, id)!
  const pos = info.contentPos + info.content.nodeSize - 1
  target.dispatch(target.state.tr.setSelection(TextSelection.create(target.state.doc, pos)))
}

function press(target: EditorView, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  return !!target.someProp('handleKeyDown', (handler) => handler(target, event))
}

const collapsed = (target: EditorView) =>
  [...target.dom.querySelectorAll('.dou-editor__block.is-collapsed')].map(
    (el) => (el as HTMLElement).dataset.blockId,
  )

const toggle = (id: string, text: string, children: PartialBlock[] = []): PartialBlock => ({
  id,
  type: 'toggle',
  content: text,
  children,
})

describe('toggle', () => {
  it('opens closed and hides its children', () => {
    const target = create([toggle('t', 'Title', [{ id: 'c', content: 'Inside' }])])
    expect(isToggleOpen(target.state, 't')).toBe(false)
    expect(collapsed(target)).toEqual(['t'])
    flipToggle(target, 't')
    expect(collapsed(target)).toEqual([])
    // opening is not an edit
    expect(docToBlocks(target.state.doc)[0]!.props).toEqual({})
  })

  it('opens when the cursor moves into its children', () => {
    const target = create([toggle('t', 'Title', [{ id: 'c', content: 'Inside' }])])
    endOf(target, 'c')
    expect(isToggleOpen(target.state, 't')).toBe(true)
  })

  it('moves the cursor out of the children it closes', () => {
    const target = create([toggle('t', 'Title', [{ id: 'c', content: 'Inside' }])])
    endOf(target, 'c')
    flipToggle(target, 't')
    expect(isToggleOpen(target.state, 't')).toBe(false)
    expect(cursor(target.state)).toEqual({ id: 't', offset: 5 })
  })

  it('Enter at the end of the title adds a first child, opening the toggle', () => {
    const target = create([toggle('t', 'Title')])
    endOf(target, 't')
    expect(press(target, 'Enter')).toBe(true)
    expect(shapeOf(target.state)).toEqual([['toggle', 'Title', [['paragraph', '']]]])
    expect(isToggleOpen(target.state, 't')).toBe(true)
    expect(target.state.selection.$from.parent.type.name).toBe('paragraph')
  })

  it('Enter at the end of a closed title adds a toggle below', () => {
    const target = create([toggle('t', 'Title', [{ id: 'c', content: 'Inside' }])])
    endOf(target, 't')
    expect(press(target, 'Enter')).toBe(true)
    expect(shapeOf(target.state)).toEqual([
      ['toggle', 'Title', [['paragraph', 'Inside']]],
      ['toggle', ''],
    ])
    // the new one starts open, the old one stays closed
    expect(collapsed(target)).toEqual(['t'])
  })

  it('reads <details> from pasted HTML', () => {
    const { schema } = resolveExtensions([starterKit()])
    const element = document.createElement('div')
    element.innerHTML = '<details><summary>More</summary></details>'
    expect(docToBlocks(DOMParser.fromSchema(schema).parse(element))[0]).toMatchObject({
      type: 'toggle',
      content: [{ text: 'More' }],
    })
  })

  it('opens in a read-only editor', async () => {
    const wrapper = mount(DouEditor, {
      attachTo: document.body,
      props: { readonly: true, modelValue: [toggle('t', 'Title', [{ id: 'c', content: 'x' }])] },
    })
    await nextTick()
    const button = wrapper.find('.dou-editor-toggle__button')
    expect(button.attributes('aria-expanded')).toBe('false')
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('.is-collapsed').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('callout', () => {
  it('keeps its tone and reads it back from HTML', async () => {
    const wrapper = mount(DouEditor, {
      attachTo: document.body,
      props: { modelValue: [{ type: 'callout', props: { tone: 'warning' }, content: 'Note' }] },
    })
    await nextTick()
    expect(wrapper.find('.dou-editor-callout').classes()).toContain('is-warning')
    wrapper.unmount()
    const { schema } = resolveExtensions([starterKit()])
    const element = document.createElement('div')
    element.innerHTML =
      '<div data-content-type="callout" data-tone="danger">A</div><div data-content-type="callout" data-tone="odd">B</div>'
    expect(
      docToBlocks(DOMParser.fromSchema(schema).parse(element)).map((block) => block.props.tone),
    ).toEqual(['danger', 'info'])
  })
})
