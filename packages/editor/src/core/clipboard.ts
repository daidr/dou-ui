import { Plugin, PluginKey } from 'prosemirror-state'

/**
 * Lists from other apps nest a list inside an item (`<li>text<ul>…</ul></li>`),
 * but a list item here is a block of text with child blocks. Rewrite them
 * into blocks before parsing, so nesting survives a paste. Task lists
 * (`<li><input type="checkbox">`) become to-do items.
 */
export function normalizeLists(html: string): string {
  if (!/<[uo]l[\s>]/i.test(html)) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const outer = Array.from(doc.body.querySelectorAll('ul, ol')).filter(
    (list) => !list.parentElement?.closest('ul, ol'),
  )
  for (const list of outer) list.replaceWith(...convertList(doc, list))
  return doc.body.innerHTML
}

function convertList(doc: Document, list: Element): HTMLElement[] {
  const numbered = list.tagName === 'OL'
  const blocks: HTMLElement[] = []
  for (const item of Array.from(list.children)) {
    if (item.tagName !== 'LI') continue
    const block = doc.createElement('div')
    block.dataset.blockId = ''
    const content = doc.createElement('div')
    const checkbox = item.querySelector(
      ':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]',
    )
    if (checkbox) {
      content.dataset.contentType = 'checkItem'
      content.dataset.checked = String(
        (checkbox as HTMLInputElement).checked || checkbox.hasAttribute('checked'),
      )
      checkbox.remove()
    } else content.dataset.contentType = numbered ? 'numberedItem' : 'bulletItem'
    const children: HTMLElement[] = []
    let first = true
    for (const node of Array.from(item.childNodes)) {
      if (node instanceof Element && (node.tagName === 'UL' || node.tagName === 'OL')) {
        children.push(...convertList(doc, node))
      } else if (node instanceof Element && node.tagName === 'P') {
        // paragraphs inside an item: one line each
        if (!first) content.append(doc.createElement('br'))
        content.append(...Array.from(node.childNodes))
        first = false
      } else {
        content.append(node)
        if (node.textContent?.trim()) first = false
      }
    }
    block.append(content)
    if (children.length) {
      const group = doc.createElement('div')
      group.className = 'dou-editor__group'
      group.append(...children)
      block.append(group)
    }
    blocks.push(block)
  }
  return blocks
}

export function clipboardPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey('dou-editor-clipboard'),
    props: { transformPastedHTML: normalizeLists },
  })
}
