import { ImageIcon } from '@dou-ui/icons'
import { Plugin } from 'prosemirror-state'
import { defineComponent, h } from 'vue'
import type { EditorExtension } from '../../core/extension'
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

const attrsOf = (dom: HTMLElement) => {
  const img = dom.tagName === 'IMG' ? (dom as HTMLImageElement) : dom.querySelector('img')
  const src = img?.getAttribute('src') ?? ''
  if (!src || !isSafeImageSrc(src)) return false
  return {
    src,
    alt: img?.getAttribute('alt') ?? '',
    caption: dom.querySelector('figcaption')?.textContent?.trim() ?? '',
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
