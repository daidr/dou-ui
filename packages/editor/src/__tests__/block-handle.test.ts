import { mount } from '@vue/test-utils'
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { findBlockById } from '../core/blocks'
import type { PartialBlock } from '../core/model'
import { bubbleShift } from '../dom'
import DouEditor from '../editor.vue'

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))

const wrappers: { unmount: () => void }[] = []
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

/** A touch screen: the handle sits next to the block with the cursor. */
function touchScreen() {
  const real = window.matchMedia.bind(window)
  vi.stubGlobal('matchMedia', (query: string) =>
    query === '(pointer: coarse)'
      ? ({
          matches: true,
          media: query,
          addEventListener() {},
          removeEventListener() {},
        } as unknown as MediaQueryList)
      : real(query),
  )
}

function mountEditor(blocks: PartialBlock[]) {
  const wrapper = mount(DouEditor, {
    props: { modelValue: { version: 1 as const, blocks } },
    attachTo: document.body,
  })
  wrappers.push(wrapper)
  const view = (wrapper.vm as unknown as { view: EditorView }).view
  return { wrapper, view }
}

async function putCursorIn(view: EditorView, id: string) {
  const info = findBlockById(view.state.doc, id)!
  let pos = info.contentPos + 1
  // a table: into its first cell's text
  if (!info.content.isTextblock) pos = TextSelection.findFrom(view.state.doc.resolve(pos), 1)!.from
  view.focus()
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)))
  await nextTick()
  await frame()
  await nextTick()
}

const table: PartialBlock = {
  id: 't',
  type: 'table',
  rows: [{ cells: ['门店', '日期'] }, { cells: ['静安店', '周一'] }],
}

describe('block handle', () => {
  it('stands further out next to a table, clear of its row handles', async () => {
    touchScreen()
    const { wrapper, view } = mountEditor([{ id: 'p', content: '上海' }, table])
    const handle = () => wrapper.find('.dou-editor__handle')
    await putCursorIn(view, 'p')
    expect(handle().isVisible()).toBe(true)
    expect(handle().classes()).not.toContain('is-table')
    await putCursorIn(view, 't')
    expect(handle().classes()).toContain('is-table')
  })

  it('gives the focus back to the text when Escape closes the block menu', async () => {
    touchScreen()
    const { wrapper, view } = mountEditor([
      { id: 'a', content: '第一段' },
      { id: 'b', content: '第二段' },
    ])
    await putCursorIn(view, 'a')
    const grip = wrapper.find('.dou-editor__grip')
    const press = { button: 0, pointerId: 1, pointerType: 'touch', bubbles: true }
    grip.element.setPointerCapture ??= () => {}
    grip.element.dispatchEvent(new PointerEvent('pointerdown', press))
    grip.element.dispatchEvent(new PointerEvent('pointerup', press))
    await nextTick()
    expect(grip.attributes('aria-expanded')).toBe('true')
    // the menu took the focus, and gives it to no one when it closes
    ;(document.activeElement as HTMLElement | null)?.blur()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    await frame()
    expect(grip.attributes('aria-expanded')).not.toBe('true')
    expect(view.dom.contains(document.activeElement)).toBe(true)
    // the block the menu was for is still selected
    expect(view.dom.querySelector('.is-selected')?.textContent).toBe('第一段')
  })
})

describe('bubbleShift', () => {
  it('stays put with room on the left', () => {
    expect(bubbleShift(40, 0)).toBe(0)
    expect(bubbleShift(2, 0)).toBe(0)
  })

  it('moves in by what it lacks of the clipping edge plus 2px', () => {
    expect(bubbleShift(-20, 0)).toBe(22)
    expect(bubbleShift(330, 345)).toBe(17)
    expect(bubbleShift(330.4, 345)).toBe(17)
  })

  it('next to a table, moves past the row handles once it has to move', () => {
    // the table's edge at 30, its row handles to 37: the bubble starts at 39
    expect(bubbleShift(0, 0, 39)).toBe(39)
    expect(bubbleShift(10, 0, 39)).toBe(0)
  })
})
