import { ChevronRightSquareIcon } from '@dou-ui/icons'
import { TextSelection, type Command } from 'prosemirror-state'
import { blockAround } from '../../core/blocks'
import { defineExtension } from '../../core/extension'
import { flipToggle, isToggleOpen, togglePlugin } from './state'
import ToggleBlock from './toggle-block.vue'

/**
 * `Enter` at the end of a toggle's title: an open toggle (or one without
 * children) gets a first child, a closed one a new toggle below it.
 */
const enter: Command = (state, dispatch, view) => {
  const { $from, empty } = state.selection
  const info = blockAround($from)
  if (!empty || !info || info.content !== $from.parent || info.content.type.name !== 'toggle')
    return false
  if ($from.parentOffset !== $from.parent.content.size || $from.parent.content.size === 0)
    return false
  const { schema } = state
  const id = info.node.attrs.id as string
  const open = isToggleOpen(state, id)
  if (!dispatch) return true
  if (!open && info.group) {
    const at = info.pos + info.node.nodeSize
    const tr = state.tr.insert(at, schema.nodes.block!.create(null, schema.nodes.toggle!.create()))
    dispatch(tr.setSelection(TextSelection.create(tr.doc, at + 2)).scrollIntoView())
    return true
  }
  if (!open && view) flipToggle(view, id)
  const child = schema.nodes.block!.create(null, schema.nodes.paragraph!.create())
  const end = info.contentPos + info.content.nodeSize
  const tr = info.group
    ? state.tr.insert(end + 1, child)
    : state.tr.insert(end, schema.nodes.blockGroup!.create(null, child))
  dispatch(tr.setSelection(TextSelection.create(tr.doc, end + 3)).scrollIntoView())
  return true
}

/**
 * A toggle: a title with a button that shows or hides the blocks nested
 * under it. Whether it is open belongs to the reader, not the document.
 */
export const toggle = defineExtension({
  name: 'toggle',
  blocks: {
    toggle: {
      content: 'inline*',
      defining: true,
      component: ToggleBlock,
      parseDOM: [{ tag: 'div[data-content-type="toggle"]' }, { tag: 'details > summary' }],
      toDOM: () => [
        'div',
        { class: 'dou-editor__content dou-editor__content--toggle', 'data-content-type': 'toggle' },
        0,
      ],
    },
  },
  keymap: () => ({ Enter: enter }),
  plugins: () => [togglePlugin()],
  blockOptions: [
    {
      key: 'toggle',
      type: 'toggle',
      label: (m) => m.types.toggle,
      hint: (m) => m.hints.toggle,
      icon: ChevronRightSquareIcon,
      keywords: ['toggle', 'collapse', 'details', 'zd', 'zhedie'],
    },
  ],
})

export { isToggleOpen }
