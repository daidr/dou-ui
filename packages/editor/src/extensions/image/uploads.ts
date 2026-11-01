import type { Node as PMNode } from 'prosemirror-model'
import type { EditorView } from 'prosemirror-view'
import { reactive } from 'vue'
import { blockAround, findBlockById } from '../../core/blocks'
import { createId, warnOnce } from '../../core/model'

/** Stores a picked, pasted or dropped file (an image or an attachment) and resolves with its address. */
export type FileUploader = (file: File) => Promise<string>

/** Without an uploader the image is kept in the document as a data URL. */
export const readAsDataUrl: FileUploader = (file) =>
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

/** What blocks hold uploaded files: an image or an attachment. */
export interface UploadTarget {
  /** The block type. */
  type: string
  /** Whether an uploader's address may be stored. */
  isSafe: (src: string) => boolean
  /** Props taken from the file when it is picked, e.g. its name and size. */
  propsOf?: (file: File) => Record<string, unknown>
  /** The addresses `isSafe` takes, for the warning when an uploader returns another. */
  allowed: string
}

const imageTarget: UploadTarget = {
  type: 'image',
  isSafe: (src) => isSafeImageSrc(src),
  allowed: 'http, https, blob, relative addresses or data:image/ URLs',
}

function setAttrs(view: EditorView, id: string, type: string, attrs: Record<string, unknown>) {
  const block = findBlockById(view.state.doc, id)
  if (!block || block.content.type.name !== type) return
  const tr = view.state.tr.setNodeMarkup(block.contentPos, undefined, {
    ...block.content.attrs,
    ...attrs,
  })
  // the file appearing is part of adding it, not a step of its own
  tr.setMeta('addToHistory', false)
  view.dispatch(tr)
}

/**
 * Uploads in progress, by block id. They live outside the document: only
 * the finished address is written into it, so other collaborators never
 * see a half-done image.
 */
export function createUploads(upload: FileUploader, target: UploadTarget = imageTarget) {
  const items = reactive(new Map<string, Upload>())
  const setSrc = (view: EditorView, id: string, src: string) =>
    setAttrs(view, id, target.type, { src })

  /** Upload a file into the block `id`; `describe` writes its props (name, size) first. */
  function start(view: EditorView, id: string, file: File, describe = true) {
    if (describe && target.propsOf) setAttrs(view, id, target.type, target.propsOf(file))
    const old = items.get(id)
    if (old) URL.revokeObjectURL(old.preview)
    const preview = URL.createObjectURL(file)
    items.set(id, { preview, failed: false })
    upload(file)
      .then((src) => {
        if (!target.isSafe(src)) {
          const message = `the ${target.type} upload returned "${src}", which is not allowed: use ${target.allowed}`
          warnOnce(message)
          throw new Error(`[@dou-ui/editor] ${message}`)
        }
        setSrc(view, id, src)
        items.delete(id)
        URL.revokeObjectURL(preview)
      })
      .catch(() => {
        if (items.get(id)?.preview === preview) items.set(id, { preview, failed: true })
      })
  }

  /** Insert one block per file after the block at `pos` and upload them; returns a position in the last one. */
  function insert(view: EditorView, files: File[], pos: number): number {
    const { schema } = view.state
    const info = blockAround(view.state.doc.resolve(Math.min(pos, view.state.doc.content.size)))
    const tr = view.state.tr
    const ids = files.map(() => createId())
    const blocks: PMNode[] = ids.map((id, index) =>
      schema.nodes.block!.create(
        { id },
        schema.nodes[target.type]!.create(target.propsOf?.(files[index]!) ?? null),
      ),
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
    files.forEach((file, index) => start(view, ids[index]!, file, false))
    return findBlockById(view.state.doc, ids.at(-1)!)?.contentPos ?? pos
  }

  return { items, start, insert, setSrc }
}

export type Uploads = ReturnType<typeof createUploads>
