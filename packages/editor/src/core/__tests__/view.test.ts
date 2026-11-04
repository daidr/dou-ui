import { TextSelection } from 'prosemirror-state'
import { afterEach, describe, expect, it } from 'vitest'
import type { EditorView } from 'prosemirror-view'
import { getBlockSelection, selectBlocks } from '../block-selection'
import { findBlockById, siblingRangeBetween } from '../blocks'
import { moveRangeTo } from '../commands'
import { createEditorView, getBlocks } from '../editor'
import { resolveEditorExtensions } from '../extension'
import { editorKit } from '../../extensions/editor-kit'
import type { PartialBlock } from '../model'
import { changesBlockStructure } from '../plugins'
import { getSlash, slashPlugin } from '../slash'
import { p, shape } from './helpers'

let view: EditorView | undefined

afterEach(() => {
  view?.destroy()
  view = undefined
})

function mount(blocks: PartialBlock[]) {
  const element = document.createElement('div')
  document.body.append(element)
  view = createEditorView({
    element,
    kit: resolveEditorExtensions([editorKit()]),
    blocks,
    placeholder: { text: () => '', heading: () => '', empty: () => '' },
    plugins: [slashPlugin({ onChange: () => {}, onKey: () => false })],
  })
  return view
}

/** Put the cursor at an offset in a block's text. */
function cursorAt(target: EditorView, id: string, offset = 0) {
  const info = findBlockById(target.state.doc, id)!
  const pos = info.contentPos + 1 + offset
  target.dispatch(target.state.tr.setSelection(TextSelection.create(target.state.doc, pos)))
}

/** Type like a keyboard: each character goes through the text input handlers first. */
function type(target: EditorView, text: string) {
  for (const char of text) {
    const { from, to } = target.state.selection
    const handled = target.someProp('handleTextInput', (handler) =>
      handler(target, from, to, char, () => target.state.tr.insertText(char, from, to)),
    )
    if (!handled) target.dispatch(target.state.tr.insertText(char, from, to))
  }
}

function press(target: EditorView, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  return !!target.someProp('handleKeyDown', (handler) => handler(target, event))
}

const blocksOf = (target: EditorView) => shape(getBlocks(target))

describe('Markdown shortcuts', () => {
  it.each([
    ['# ', 'heading', { level: 1 }],
    ['### ', 'heading', { level: 3 }],
    ['- ', 'bulletItem', {}],
    ['1. ', 'numberedItem', {}],
    ['[x] ', 'checkItem', { checked: true }],
    ['> ', 'quote', {}],
    ['```', 'codeBlock', { language: '' }],
  ])('turns `%s` at the start of a block into %s', (input, type_, props) => {
    const target = mount([p('a')])
    cursorAt(target, 'a')
    type(target, input)
    const [block] = getBlocks(target)
    expect(block).toMatchObject({ id: 'a', type: type_, props, content: [] })
  })

  it('leaves the markers alone in the middle of text', () => {
    const target = mount([p('a', 'x')])
    cursorAt(target, 'a', 1)
    type(target, '# ')
    expect(blocksOf(target)).toEqual([['paragraph', 'x# ']])
  })

  it('turns `---` in an empty block into a divider', () => {
    const target = mount([p('a')])
    cursorAt(target, 'a')
    type(target, '---')
    expect(blocksOf(target)).toEqual([
      ['divider', ''],
      ['paragraph', ''],
    ])
  })

  it('formats text between markers', () => {
    const target = mount([p('a')])
    cursorAt(target, 'a')
    type(target, 'a **b** `c`')
    expect(getBlocks(target)[0]!.content).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'text', text: 'b', marks: ['bold'] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'c', marks: ['code'] },
    ])
  })
})

describe('slash menu', () => {
  it('opens on `/` at the start of a block and tracks the query', () => {
    const target = mount([p('a')])
    cursorAt(target, 'a')
    type(target, '/hea')
    expect(getSlash(target.state)).toMatchObject({ query: 'hea' })
    press(target, 'Escape')
    expect(getSlash(target.state)).toBeNull()
  })

  it('opens on the `、` a Chinese keyboard types for `/`', () => {
    const target = mount([p('a', '你好')])
    cursorAt(target, 'a', 2)
    type(target, '、')
    expect(getSlash(target.state)).toMatchObject({ query: '' })
  })

  it('does not open inside a word or a URL', () => {
    const target = mount([p('a', 'https:')])
    cursorAt(target, 'a', 6)
    type(target, '/')
    expect(getSlash(target.state)).toBeNull()
  })

  it('closes when the trigger is deleted', () => {
    const target = mount([p('a')])
    cursorAt(target, 'a')
    type(target, '/')
    const { from } = target.state.selection
    target.dispatch(target.state.tr.delete(from - 1, from))
    expect(getSlash(target.state)).toBeNull()
  })
})

describe('block selection', () => {
  it('deletes the selected blocks with Backspace', () => {
    const target = mount([p('a', 'A'), p('b', 'B'), p('c', 'C')])
    selectBlocks('a', 'b')(target.state, target.dispatch)
    expect(getBlockSelection(target.state)).toEqual({ anchor: 'a', head: 'b' })
    expect(press(target, 'Backspace')).toBe(true)
    expect(blocksOf(target)).toEqual([['paragraph', 'C']])
    expect(getBlockSelection(target.state)).toBeNull()
  })

  it('moves and extends with the arrow keys', () => {
    const target = mount([p('a', 'A'), p('b', 'B'), p('c', 'C')])
    selectBlocks('a')(target.state, target.dispatch)
    press(target, 'ArrowDown')
    expect(getBlockSelection(target.state)).toEqual({ anchor: 'b', head: 'b' })
    press(target, 'ArrowDown', { shiftKey: true })
    expect(getBlockSelection(target.state)).toEqual({ anchor: 'b', head: 'c' })
  })

  it('ends when the text selection moves', () => {
    const target = mount([p('a', 'A'), p('b', 'B')])
    selectBlocks('a')(target.state, target.dispatch)
    cursorAt(target, 'b', 1)
    expect(getBlockSelection(target.state)).toBeNull()
  })
})

describe('moveRangeTo', () => {
  it('moves a block into another level, taking its children along', () => {
    const target = mount([p('a', 'A', [p('a1', 'A1')]), p('b', 'B', [p('b1', 'B1')])])
    const doc = target.state.doc
    const b = findBlockById(doc, 'b')!
    const a1 = findBlockById(doc, 'a1')!
    const range = siblingRangeBetween(doc, b.pos + 1, b.pos + 1)!
    expect(moveRangeTo(range, a1.pos)(target.state, target.dispatch)).toBe(true)
    expect(blocksOf(target)).toEqual([
      [
        'paragraph',
        'A',
        [
          ['paragraph', 'B', [['paragraph', 'B1']]],
          ['paragraph', 'A1'],
        ],
      ],
    ])
  })

  it('removes a group that the move empties', () => {
    const target = mount([p('a', 'A', [p('a1', 'A1')]), p('b', 'B')])
    const doc = target.state.doc
    const a1 = findBlockById(doc, 'a1')!
    const b = findBlockById(doc, 'b')!
    const range = siblingRangeBetween(doc, a1.pos + 1, a1.pos + 1)!
    moveRangeTo(range, b.pos + b.node.nodeSize)(target.state, target.dispatch)
    expect(blocksOf(target)).toEqual([
      ['paragraph', 'A'],
      ['paragraph', 'B'],
      ['paragraph', 'A1'],
    ])
  })

  it('refuses to move blocks into themselves', () => {
    const target = mount([p('a', 'A', [p('a1', 'A1')])])
    const doc = target.state.doc
    const a = findBlockById(doc, 'a')!
    const a1 = findBlockById(doc, 'a1')!
    const range = siblingRangeBetween(doc, a.pos + 1, a.pos + 1)!
    expect(moveRangeTo(range, a1.pos)(target.state)).toBe(false)
  })
})

describe('ids', () => {
  it('keeps every id unique when blocks are copied', () => {
    const target = mount([p('a', 'A'), p('b', 'B')])
    const a = findBlockById(target.state.doc, 'a')!
    target.dispatch(target.state.tr.insert(a.pos, a.node))
    const ids = getBlocks(target).map((block) => block.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids).toContain('a')
  })

  it('leaves blocks from collaborators alone', () => {
    const target = mount([p('a', 'A')])
    const a = findBlockById(target.state.doc, 'a')!
    target.dispatch(target.state.tr.insert(a.pos, a.node).setMeta('remote', true))
    expect(getBlocks(target).map((block) => block.id)).toEqual(['a', 'a'])
  })
})

describe('paste', () => {
  it('keeps nested lists and drops unsafe links', () => {
    const target = mount([p('a')])
    cursorAt(target, 'a')
    target.pasteHTML(
      '<ul><li>One</li><li>Two<ul><li>Child</li></ul></li></ul>' +
        '<p><a href="javascript:alert(1)">bad</a> <a href="https://ui.daidr.me">good</a></p>',
    )
    const blocks = getBlocks(target)
    expect(shape(blocks)).toEqual([
      ['bulletItem', 'One'],
      ['bulletItem', 'Two', [['bulletItem', 'Child']]],
      ['paragraph', 'bad good'],
    ])
    expect(blocks[2]!.content).toEqual([
      { type: 'text', text: 'bad ' },
      { type: 'text', text: 'good', link: 'https://ui.daidr.me' },
    ])
  })

  it('turns task lists into to-do items', () => {
    const target = mount([p('a')])
    cursorAt(target, 'a')
    target.pasteHTML(
      '<ul><li><input type="checkbox" checked> Done</li><li><p><input type="checkbox"> Todo</p></li></ul>',
    )
    expect(getBlocks(target).map((block) => [block.type, block.props.checked])).toEqual([
      ['checkItem', true],
      ['checkItem', false],
    ])
  })
})

const classesOf = (target: EditorView) =>
  Object.fromEntries(
    [...target.dom.querySelectorAll<HTMLElement>('.dou-editor__block')].map((block) => [
      block.dataset.blockId,
      ['is-list', 'is-list-start', 'is-list-end'].filter((name) =>
        block.querySelector(':scope > .dou-editor__content')!.classList.contains(name),
      ),
    ]),
  )

describe('list spacing', () => {
  it('marks list items and the ends of their runs, nested items carrying on the run', () => {
    const target = mount([
      p('intro'),
      { id: 'a', type: 'bulletItem', content: 'a' },
      {
        id: 'b',
        type: 'numberedItem',
        content: 'b',
        children: [
          { id: 'b1', type: 'checkItem', content: 'b1' },
          { id: 'b2', type: 'bulletItem', content: 'b2' },
        ],
      },
      { id: 'c', type: 'paragraph', content: 'c', children: [{ id: 'c1', type: 'bulletItem' }] },
    ])
    expect(classesOf(target)).toEqual({
      intro: [],
      // a numbered list right after a bulleted one is a list of its own
      a: ['is-list', 'is-list-start', 'is-list-end'],
      b: ['is-list', 'is-list-start', 'is-list-end'],
      // nested under a list item, any type carries on its run; siblings of another type split it
      b1: ['is-list', 'is-list-end'],
      b2: ['is-list', 'is-list-start'],
      c: [],
      c1: ['is-list', 'is-list-start', 'is-list-end'],
    })
  })

  it('maps through typing, rebuilds when blocks change', () => {
    const target = mount([
      { id: 'a', type: 'bulletItem', content: 'a' },
      { id: 'b', type: 'bulletItem', content: 'b' },
    ])
    cursorAt(target, 'a', 1)
    const typing = target.state.tr.insertText('x')
    expect(changesBlockStructure(typing)).toBe(false)
    target.dispatch(typing)
    expect(changesBlockStructure(target.state.tr.split(target.state.selection.from, 2))).toBe(true)
    press(target, 'Enter')
    expect(classesOf(target)).toEqual({
      a: ['is-list', 'is-list-start'],
      [getBlocks(target)[1]!.id]: ['is-list'],
      b: ['is-list', 'is-list-end'],
    })
  })

  it('follows changes to the document', () => {
    const target = mount([p('a'), { id: 'b', type: 'bulletItem', content: 'b' }])
    cursorAt(target, 'a')
    type(target, '- ')
    expect(classesOf(target)).toEqual({
      a: ['is-list', 'is-list-start'],
      b: ['is-list', 'is-list-end'],
    })
  })
})
