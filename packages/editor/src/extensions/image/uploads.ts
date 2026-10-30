import type { Node as PMNode } from 'prosemirror-model'
import type { EditorView } from 'prosemirror-view'
import { reactive } from 'vue'
import { blockAround, findBlockById } from '../../core/blocks'
import { createId } from '../../core/model'

/** Turns a picked or pasted file into the address the image is stored at. */
export type ImageUploader = (file: File) => Promise<string>

/** Without an uploader the image is kept in the document as a data URL. */
export const readAsDataUrl: ImageUploader = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsDataURL(file)
  })

/** Image addresses that are safe to show: web, relative, and images held in the page. */
export function isSafeImageSrc(src: string): boolean {
  // eslint-disable-next-line no-control-regex
  const value = src.replace(/[\u0000- ]/g, '')
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value)?.[1]?.toLowerCase()
  if (!scheme) return true
  // an image element never runs scripts, so SVG is fine here too
  if (scheme === 'data') return /^data:image\//i.test(value)
  return ['http', 'https', 'blob'].includes(scheme)
}

export interface Upload {
  /** A local copy shown while uploading. */
  preview: string
  failed: boolean
}

function setSrc(view: EditorView, id: string, src: string) {
  const block = findBlockById(view.state.doc, id)
  if (!block || block.content.type.name !== 'image') return
  const tr = view.state.tr.setNodeMarkup(block.contentPos, undefined, {
    ...block.content.attrs,
    src,
  })
  // the image appearing is part of adding it, not a step of its own
  tr.setMeta('addToHistory', false)
  view.dispatch(tr)
}

/**
 * Uploads in progress, by block id. They live outside the document: only
 * the finished address is written into it, so other collaborators never
 * see a half-done image.
 */
export function createUploads(upload: ImageUploader) {
  const items = reactive(new Map<string, Upload>())

  function start(view: EditorView, id: string, file: File) {
    const old = items.get(id)
    if (old) URL.revokeObjectURL(old.preview)
    const preview = URL.createObjectURL(file)
    items.set(id, { preview, failed: false })
    upload(file)
      .then((src) => {
        if (!isSafeImageSrc(src)) throw new Error(`[@dou-ui/editor] unsafe image address: ${src}`)
        setSrc(view, id, src)
        items.delete(id)
        URL.revokeObjectURL(preview)
      })
      .catch(() => {
        if (items.get(id)?.preview === preview) items.set(id, { preview, failed: true })
      })
  }

  /** Insert one image block per file after the block at `pos` and upload them. */
  function insert(view: EditorView, files: File[], pos: number) {
    const { schema } = view.state
    const info = blockAround(view.state.doc.resolve(Math.min(pos, view.state.doc.content.size)))
    const tr = view.state.tr
    const ids = files.map(() => createId())
    const blocks: PMNode[] = ids.map((id) =>
      schema.nodes.block!.create({ id }, schema.nodes.image!.create()),
    )
    if (!info) {
      tr.insert(view.state.doc.content.size, blocks)
    } else if (
      info.content.type.name === 'paragraph' &&
      info.content.content.size === 0 &&
      !info.group
    ) {
      // an empty paragraph makes room for the images
      tr.replaceWith(info.pos, info.pos + info.node.nodeSize, blocks)
    } else {
      tr.insert(info.pos + info.node.nodeSize, blocks)
    }
    view.dispatch(tr.scrollIntoView())
    files.forEach((file, index) => start(view, ids[index]!, file))
  }

  return { items, start, insert, setSrc }
}

export type Uploads = ReturnType<typeof createUploads>

/** The image files among dropped or pasted data. */
export function imageFiles(data: DataTransfer | null): File[] {
  return Array.from(data?.files ?? []).filter((file) => file.type.startsWith('image/'))
}
