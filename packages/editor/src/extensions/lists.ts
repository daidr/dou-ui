import { ListIcon, ListOrderedIcon, ListTodoIcon } from '@dou-ui/icons'
import type { NodeViewConstructor } from 'prosemirror-view'
import { setBlockType } from '../core/commands'
import { defineExtension } from '../core/extension'
import { blockInputRule } from '../core/input-rules'
import { createId } from '../core/model'
import { numberingPlugin } from '../core/plugins'
import { contentDOM, textBlock } from '../core/schema'
import { listItemMarkdown, prepareLists } from './list-html'

const SVG = 'http://www.w3.org/2000/svg'

/** The check of `CheckIcon`, drawn at the checkbox's stroke width. */
function checkMark(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS(SVG, 'path')
  path.setAttribute('d', 'm5 12.5 4.5 4.5L19 7.5')
  for (const [name, value] of Object.entries({
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }))
    path.setAttribute(name, value)
  svg.append(path)
  return svg
}

/** A to-do item: a real checkbox in front of the text, its state in the node's attributes. */
const checkItemView: NodeViewConstructor = (node, view, getPos) => {
  const dom = document.createElement('div')
  dom.className = 'dou-editor__content dou-editor__content--checkItem'
  dom.dataset.contentType = 'checkItem'
  const box = document.createElement('span')
  box.className = 'dou-editor__check'
  box.contentEditable = 'false'
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'dou-editor__checkbox'
  button.setAttribute('role', 'checkbox')
  button.append(checkMark())
  box.append(button)
  const text = document.createElement('div')
  text.className = 'dou-editor__text'
  // the item's own text names the checkbox
  text.id = `dou-editor-check-${createId()}`
  button.setAttribute('aria-labelledby', text.id)
  dom.append(box, text)

  let current = node
  const sync = () => {
    const checked = !!current.attrs.checked
    dom.dataset.checked = String(checked)
    button.setAttribute('aria-checked', String(checked))
    button.disabled = !view.editable
  }
  sync()
  button.addEventListener('mousedown', (event) => event.preventDefault())
  button.addEventListener('click', () => {
    const pos = getPos()
    if (pos === undefined || !view.editable) return
    view.dispatch(view.state.tr.setNodeAttribute(pos, 'checked', !current.attrs.checked))
  })
  return {
    dom,
    contentDOM: text,
    update(next) {
      if (next.type !== current.type) return false
      current = next
      sync()
      return true
    },
    ignoreMutation: (mutation) => box.contains(mutation.target),
    stopEvent: (event) => box.contains(event.target as Node),
  }
}

/**
 * Bulleted, numbered and to-do lists. Each item is a block of its own:
 * `Enter` continues the list, `Tab` nests an item. Pasted HTML lists keep
 * their nesting, and task lists become to-do items.
 */
export const lists = defineExtension({
  name: 'lists',
  blocks: {
    bulletItem: textBlock('bulletItem', {
      continues: true,
      parseDOM: [{ tag: 'div[data-content-type="bulletItem"]' }, { tag: 'ul > li' }],
    }),
    numberedItem: textBlock('numberedItem', {
      continues: true,
      parseDOM: [{ tag: 'div[data-content-type="numberedItem"]' }, { tag: 'ol > li' }],
    }),
    checkItem: textBlock('checkItem', {
      continues: true,
      attrs: { checked: { default: false } },
      parseDOM: [
        {
          tag: 'div[data-content-type="checkItem"]',
          getAttrs: (dom) => ({ checked: (dom as HTMLElement).dataset.checked === 'true' }),
        },
      ],
      toDOM: (node) => contentDOM('checkItem', { 'data-checked': String(node.attrs.checked) }),
    }),
  },
  nodeViews: { checkItem: checkItemView },
  plugins: () => [numberingPlugin()],
  prepareHTML: prepareLists,
  output: {
    blocks: {
      bulletItem: {
        group: 'ul',
        html: (_block, { content, children }) => `<li>${content}${children}</li>`,
        markdown: (_block, context) => listItemMarkdown('- ', context),
      },
      numberedItem: {
        group: 'ol',
        html: (_block, { content, children }) => `<li>${content}${children}</li>`,
        markdown: (_block, context) => listItemMarkdown(`${context.index}. `, context),
      },
      checkItem: {
        group: 'ul class="task-list"',
        html: (block, { content, children }) =>
          `<li><input type="checkbox" disabled${block.props.checked ? ' checked' : ''}> ${content}${children}</li>`,
        markdown: (block, context) =>
          listItemMarkdown(block.props.checked ? '- [x] ' : '- [ ] ', context),
      },
    },
  },
  inputRules: () => [
    blockInputRule(/^[-*+]\s$/, 'bulletItem'),
    blockInputRule(/^1[.)]\s$/, 'numberedItem'),
    blockInputRule(/^\[( |x)?\]\s$/i, 'checkItem', (match) => ({
      checked: match[1]?.toLowerCase() === 'x',
    })),
  ],
  keymap: () => ({
    'Mod-Shift-7': setBlockType('numberedItem'),
    'Mod-Shift-8': setBlockType('bulletItem'),
    'Mod-Shift-9': setBlockType('checkItem'),
  }),
  blockOptions: [
    {
      key: 'bulletItem',
      type: 'bulletItem',
      label: (m) => m.types.bulletItem,
      hint: (m) => m.hints.bulletItem,
      icon: ListIcon,
      keywords: ['ul', 'bullet', 'list', 'lb', 'liebiao'],
      shortcut: '-',
    },
    {
      key: 'numberedItem',
      type: 'numberedItem',
      label: (m) => m.types.numberedItem,
      hint: (m) => m.hints.numberedItem,
      icon: ListOrderedIcon,
      keywords: ['ol', 'number', 'ordered', 'list', 'lb', 'bianhao'],
      shortcut: '1.',
    },
    {
      key: 'checkItem',
      type: 'checkItem',
      label: (m) => m.types.checkItem,
      hint: (m) => m.hints.checkItem,
      icon: ListTodoIcon,
      keywords: ['todo', 'task', 'check', 'db', 'daiban', 'renwu'],
      shortcut: '[]',
    },
  ],
})
