import { indentLines, type BlockOutputContext } from '../core/output'
import { blockElement, splitContainer } from '../core/prepare'

const TASK = /^\s*\[( |x|X)\]\s/

/**
 * Lists from other apps nest a list inside an item (`<li>text<ul>…</ul></li>`),
 * but a list item here is a block of text with child blocks. Rewrite them
 * into blocks before parsing, so nesting survives. Task lists
 * (`<li><input type="checkbox">`, or `[ ]` / `[x]` before the text as
 * Markdown writes them) become to-do items.
 */
export function prepareLists(root: HTMLElement) {
  const outer = Array.from(root.querySelectorAll('ul, ol')).filter(
    (list) => !list.parentElement?.closest('ul, ol'),
  )
  for (const list of outer) list.replaceWith(...convertList(list))
}

function convertList(list: Element): HTMLElement[] {
  const doc = list.ownerDocument
  const numbered = list.tagName === 'OL'
  const blocks: HTMLElement[] = []
  for (const item of Array.from(list.children)) {
    if (item.tagName !== 'LI') continue
    let type = numbered ? 'numberedItem' : 'bulletItem'
    const data: Record<string, string> = {}
    const checkbox = item.querySelector(
      ':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]',
    )
    if (checkbox) {
      type = 'checkItem'
      data.checked = String(
        (checkbox as HTMLInputElement).checked || checkbox.hasAttribute('checked'),
      )
      checkbox.remove()
    } else {
      const text = firstText(item)
      const match = text && TASK.exec(text.data)
      if (text && match) {
        type = 'checkItem'
        data.checked = String(match[1] !== ' ')
        text.data = text.data.slice(match[0].length)
      }
    }
    // the first paragraph is the item's text; what follows becomes its children
    for (const nested of Array.from(item.children))
      if (nested.tagName === 'UL' || nested.tagName === 'OL')
        nested.replaceWith(...convertList(nested))
    const { content, children } = splitContainer(item)
    blocks.push(blockElement(doc, type, content, children, data))
  }
  return blocks
}

function firstText(item: Element): Text | null {
  // NodeFilter.SHOW_TEXT, as a number: the DOM may come from a library, without globals
  const walker = item.ownerDocument.createTreeWalker(item, 4)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent?.trim()) return node as Text
  }
  return null
}

/** A list item in Markdown: the marker, the text, and the children indented under it. */
export function listItemMarkdown(marker: string, { content, children }: BlockOutputContext) {
  // a checkbox marker indents its children like the bullet in front of it
  const width = marker.startsWith('- [') ? 2 : marker.length
  const item = indentLines(content, marker, ' '.repeat(width))
  if (!children) return item
  // a nested list follows right after; other blocks need a blank line, or they join the text
  const gap = /^([-*+]|\d+[.)])( |$)/.test(children) ? '\n' : '\n\n'
  return `${item}${gap}${indentLines(children, ' '.repeat(width))}`
}
