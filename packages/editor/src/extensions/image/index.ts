import { ImageIcon } from '@dou-ui/icons'
import { Plugin } from 'prosemirror-state'
import { defineComponent, h } from 'vue'
import type { EditorExtension } from '../../core/extension'
import { escapeHTML, escapeMarkdown } from '../../core/output'
import { defineBlock } from '../../define-block'
import ImageBlock from './image-block.vue'
import {
  createUploads,
  imageFiles,
  isSafeImageSrc,
  readAsDataUrl,
  type ImageUploader,
} from './uploads'

export interface ImageOptions {
  /**
   * Store a picked, pasted or dropped file and resolve with its address.
   * Without it, images are kept in the document as data URLs, which suits
   * trying things out but makes documents large.
   */
  upload?: ImageUploader
}

/** A width in percent, as `blocksToHTML` writes it on the figure. */
function widthOf(dom: HTMLElement): number | null {
  const match = /^(\d+(?:\.\d+)?)%$/.exec(dom.style?.width ?? '')
  return match ? Math.min(100, Math.max(20, Number(match[1]))) : null
}

const attrsOf = (dom: HTMLElement) => {
  const img = dom.tagName === 'IMG' ? (dom as HTMLImageElement) : dom.querySelector('img')
  const src = img?.getAttribute('src') ?? ''
  if (!src || !isSafeImageSrc(src)) return false
  return {
    src,
    alt: img?.getAttribute('alt') ?? '',
    caption:
      dom.querySelector('figcaption')?.textContent?.trim() ?? img?.getAttribute('title') ?? '',
    width: widthOf(dom),
  }
}

/**
 * Image blocks: upload a file, paste or drop images, or embed a link. The
 * image can be resized and given a caption.
 */
export function image(options: ImageOptions = {}): EditorExtension {
  const uploads = createUploads(options.upload ?? readAsDataUrl)
  const View = defineComponent({
    name: 'DouEditorImageView',
    inheritAttrs: false,
    setup(_props, { attrs }) {
      return () => h(ImageBlock, { ...attrs, uploads } as never)
    },
  })
  const block = defineBlock({
    type: 'image',
    props: { src: '', alt: '', caption: '', width: null },
    content: 'none',
    component: View,
    menu: {
      label: (m) => m.types.image,
      hint: (m) => m.hints.image,
      icon: ImageIcon,
      keywords: ['image', 'picture', 'img', 'tp', 'tupian', 'zhaopian'],
    },
    spec: {
      parseDOM: [
        { tag: 'figure', getAttrs: (dom) => attrsOf(dom as HTMLElement) },
        { tag: 'img[src]', getAttrs: (dom) => attrsOf(dom as HTMLElement) },
      ],
      toDOM: (node) => {
        const img = ['img', { src: node.attrs.src, alt: node.attrs.alt || node.attrs.caption }]
        const style = node.attrs.width ? `width: ${node.attrs.width}%` : null
        return [
          'figure',
          {
            class: 'dou-editor__content dou-editor__content--image',
            'data-content-type': 'image',
            style,
          },
          img,
          ...(node.attrs.caption ? [['figcaption', node.attrs.caption]] : []),
        ] as never
      },
    },
  })
  return {
    ...block,
    output: {
      blocks: {
        image: {
          html: (node, { children }) => {
            const { src, alt, caption, width } = node.props
            if (!src || !isSafeImageSrc(String(src))) return children
            const style = width ? ` style="width: ${Number(width)}%"` : ''
            const label = escapeHTML(String(alt || caption || ''))
            const figcaption = caption
              ? `<figcaption>${escapeHTML(String(caption))}</figcaption>`
              : ''
            return `<figure${style}><img src="${escapeHTML(String(src))}" alt="${label}">${figcaption}</figure>${children}`
          },
          markdown: (node, { children }) => {
            const { src, alt, caption } = node.props
            if (!src || !isSafeImageSrc(String(src))) return children
            const label = escapeMarkdown(String(alt || caption || ''))
            const title = caption ? ` "${String(caption).replace(/["\\]/g, '\\$&')}"` : ''
            const address = /[\s()<>]/.test(String(src)) ? `<${String(src)}>` : String(src)
            const written = `![${label}](${address}${title})`
            return children ? `${written}\n\n${children}` : written
          },
        },
      },
    },
    // Markdown puts an image inside a paragraph of its own
    prepareHTML: (root) => {
      for (const img of Array.from(root.querySelectorAll('p > img'))) {
        const paragraph = img.parentElement!
        if (paragraph.textContent?.trim() || paragraph.children.length > 1) continue
        paragraph.replaceWith(img)
      }
    },
    plugins: () => [
      new Plugin({
        props: {
          handlePaste(view, event) {
            const files = imageFiles(event.clipboardData)
            // an image copied from a page comes with its address: keep that
            if (!files.length || /<img/i.test(event.clipboardData?.getData('text/html') ?? ''))
              return false
            uploads.insert(view, files, view.state.selection.from)
            return true
          },
          handleDrop(view, event) {
            const files = imageFiles(event.dataTransfer)
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

export { isSafeImageSrc, readAsDataUrl, type ImageUploader }
