import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { Plugin, PluginKey } from 'prosemirror-state'
import type { ResolvedEditorExtensions } from './extension'
import { createId, docToBlocks, type Block } from './model'

/**
 * The editor's own markup for a block: a content element of `type` holding
 * `content`, followed by a group holding `children`. Extensions use it in
 * `prepareHTML` to turn containers such as `<details>` into blocks.
 */
export function blockElement(
  doc: Document,
  type: string,
  content: Node[],
  children: Node[] = [],
  data: Record<string, string> = {},
): HTMLElement {
  const block = doc.createElement('div')
  block.dataset.blockId = ''
  const element = doc.createElement('div')
  element.dataset.contentType = type
  Object.assign(element.dataset, data)
  element.append(...content)
  block.append(element)
  if (children.some((node) => node.nodeType === 1 || node.textContent?.trim())) {
    const group = doc.createElement('div')
    group.className = 'dou-editor__group'
    group.append(...children)
    block.append(group)
  }
  return block
}

/**
 * Split a container's children into its own text (the first paragraph, or
 * the inline nodes before the first block element) and the blocks after it.
 */
export function splitContainer(element: Element): { content: Node[]; children: Node[] } {
  const nodes = Array.from(element.childNodes)
  while (nodes.length && isBlank(nodes[0]!)) nodes.shift()
  const first = nodes[0]
  if (first instanceof Element && first.tagName === 'P')
    return { content: Array.from(first.childNodes), children: nodes.slice(1) }
  const content: Node[] = []
  while (nodes.length && !isBlockElement(nodes[0]!)) content.push(nodes.shift()!)
  return { content, children: nodes }
}

const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DETAILS',
  'DIV',
  'DL',
  'FIGURE',
  'FOOTER',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'UL',
])

const isBlank = (node: Node) => node.nodeType === 3 && !node.textContent?.trim()

const isBlockElement = (node: Node) => node instanceof Element && BLOCK_TAGS.has(node.tagName)

/** Run every extension's `prepareHTML` over the markup. */
export function prepareElement(root: HTMLElement, kit: ResolvedEditorExtensions) {
  for (const extension of kit.extensions) extension.prepareHTML?.(root)
}

/** Read HTML as blocks, with the block types, inline nodes and marks of `kit`. */
export function parseHTML(html: string, kit: ResolvedEditorExtensions): Block[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  prepareElement(doc.body, kit)
  const blocks = docToBlocks(PMDOMParser.fromSchema(kit.schema).parse(doc.body))
  const fill = (list: Block[]) => {
    for (const block of list) {
      block.id ||= createId()
      fill(block.children)
    }
  }
  fill(blocks)
  return blocks
}

/** Pasted HTML goes through the extensions' `prepareHTML` too. */
export function preparePastePlugin(kit: ResolvedEditorExtensions): Plugin {
  return new Plugin({
    key: new PluginKey('dou-editor-paste'),
    props: {
      transformPastedHTML(html) {
        if (!kit.extensions.some((extension) => extension.prepareHTML)) return html
        const doc = new DOMParser().parseFromString(html, 'text/html')
        prepareElement(doc.body, kit)
        return doc.body.innerHTML
      },
    },
  })
}
