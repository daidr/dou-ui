import { PaperclipIcon } from '@dou-ui/icons'
import { Plugin } from 'prosemirror-state'
import { defineComponent, h } from 'vue'
import type { EditorExtension } from '../../core/extension'
import { escapeHTML, escapeMarkdown } from '../../core/output'
import { defineBlock } from '../../define-block'
import { createUploads, readAsDataUrl, type ImageUploader } from '../image/uploads'
import AttachmentBlock from './attachment-block.vue'
import { formatFileSize, isSafeFileSrc } from './files'

/** Stores a picked, pasted or dropped file and resolves with its address. */
export type FileUploader = ImageUploader

export interface AttachmentOptions {
  /**
   * Store the file and resolve with its address. Without it, files are
   * kept in the document as data URLs, which suits trying things out but
   * makes documents large.
   */
  upload?: FileUploader
  /** The file types the picker offers, as the `accept` of a file input. */
  accept?: string
}

const propsOf = (file: File) => ({ name: file.name, size: file.size, mime: file.type })

function attrsOf(dom: HTMLElement) {
  const src = dom.getAttribute('href') ?? ''
  if (!src || !isSafeFileSrc(src)) return false
  const size = Number(dom.dataset.size)
  return {
    src,
    name: dom.getAttribute('download') || dom.textContent?.trim() || '',
    size: Number.isFinite(size) && dom.dataset.size ? size : null,
    mime: dom.dataset.mime ?? '',
  }
}

/** Files, other than images when the image block is there: drop them in, paste them, or pick one. */
function filesOf(data: DataTransfer | null, images: boolean) {
  return Array.from(data?.files ?? []).filter((file) => !(images && file.type.startsWith('image/')))
}

/**
 * Attachment blocks: a file with its name and size and a download button.
 * Files dropped or pasted into the editor become attachments (images stay
 * images when the image block is there).
 */
export function attachment(options: AttachmentOptions = {}): EditorExtension {
  const uploads = createUploads(options.upload ?? readAsDataUrl, {
    type: 'attachment',
    isSafe: isSafeFileSrc,
    propsOf,
  })
  const View = defineComponent({
    name: 'DouEditorAttachmentView',
    inheritAttrs: false,
    setup(_props, { attrs }) {
      return () => h(AttachmentBlock, { ...attrs, uploads, accept: options.accept } as never)
    },
  })
  const block = defineBlock({
    type: 'attachment',
    props: { src: '', name: '', size: null, mime: '' },
    content: 'none',
    component: View,
    menu: {
      label: (m) => m.types.attachment,
      hint: (m) => m.hints.attachment,
      icon: PaperclipIcon,
      keywords: ['file', 'attachment', 'upload', 'fj', 'fujian', 'wenjian'],
    },
    spec: {
      parseDOM: [
        { tag: 'a[data-attachment]', priority: 60, getAttrs: (dom) => attrsOf(dom as HTMLElement) },
      ],
      toDOM: (node) => [
        'div',
        {
          class: 'dou-editor__content dou-editor__content--attachment',
          'data-content-type': 'attachment',
        },
        [
          'a',
          {
            href: isSafeFileSrc(String(node.attrs.src)) ? node.attrs.src : null,
            download: node.attrs.name || '',
            'data-attachment': '',
            'data-size': node.attrs.size ?? null,
            'data-mime': node.attrs.mime || null,
          },
          node.attrs.name || node.attrs.src,
        ],
      ],
    },
  })
  return {
    ...block,
    output: {
      blocks: {
        attachment: {
          html: (node, { children }) => {
            const { src, name, size, mime } = node.props
            if (!src || !isSafeFileSrc(String(src))) return children
            const label = escapeHTML(String(name || src))
            const extra = [
              size != null && size !== '' ? ` data-size="${Number(size)}"` : '',
              mime ? ` data-mime="${escapeHTML(String(mime))}"` : '',
            ].join('')
            const shown = size != null && size !== '' ? ` (${formatFileSize(size)})` : ''
            return `<p><a href="${escapeHTML(String(src))}" download="${escapeHTML(String(name ?? ''))}" data-attachment${extra}>${label}</a>${escapeHTML(shown)}</p>${children}`
          },
          markdown: (node, { children }) => {
            const { src, name } = node.props
            if (!src || !isSafeFileSrc(String(src))) return children
            const address = /[\s()<>]/.test(String(src)) ? `<${String(src)}>` : String(src)
            const written = `[${escapeMarkdown(String(name || src))}](${address})`
            return children ? `${written}\n\n${children}` : written
          },
        },
      },
    },
    // an attachment written as HTML sits in a paragraph of its own
    prepareHTML: (root) => {
      for (const link of Array.from(root.querySelectorAll('p > a[data-attachment]'))) {
        const paragraph = link.parentElement!
        if (paragraph.children.length > 1) continue
        paragraph.replaceWith(link)
      }
    },
    plugins: ({ schema }) => [
      new Plugin({
        props: {
          handlePaste(view, event) {
            const files = filesOf(event.clipboardData, !!schema.nodes.image)
            if (!files.length) return false
            uploads.insert(view, files, view.state.selection.from)
            return true
          },
          handleDrop(view, event) {
            const files = filesOf(event.dataTransfer, !!schema.nodes.image)
            if (!files.length) return false
            event.preventDefault()
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY })
            uploads.insert(view, files, at?.pos ?? view.state.selection.from)
            return true
          },
        },
      }),
    ],
  }
}

export { formatFileSize, isSafeFileSrc }
