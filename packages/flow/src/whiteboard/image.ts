import type { FlowEditorContext } from '../context'
import type { Point } from '../core/model'
import { format } from '../locale'
import { boardState } from './state'

/** Turns a file into the `src` an image node keeps, e.g. by uploading it. */
export type WhiteboardUpload = (file: File) => string | Promise<string>

/** Without an upload, images are kept in the document as data URLs. */
const readAsDataUrl: WhiteboardUpload = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsDataURL(file)
  })

/** An image's own size, or `null` when it can't be loaded. */
function naturalSize(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.addEventListener('load', () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight }),
    )
    img.addEventListener('error', () => resolve(null))
    // an image that never answers gets the default size
    setTimeout(() => resolve(null), 4000)
    img.src = src
  })
}

/** New images are at most this wide or tall, in canvas units. */
const MAX_SIDE = 320

export const imageFiles = (files: Iterable<File> | null | undefined) =>
  [...(files ?? [])].filter((file) => file.type.startsWith('image/'))

/**
 * Adds an image node for each file, centred on `at` (the middle of the view
 * when left out) and stepped down and right when there are several.
 */
export async function insertImages(
  ctx: FlowEditorContext,
  files: File[],
  upload: WhiteboardUpload = readAsDataUrl,
  at?: Point,
) {
  const state = boardState(ctx)
  const t = ctx.messages.value.board
  const root = ctx.root.value
  if (!root || ctx.readonly.value) return
  const box = root.getBoundingClientRect()
  const centre = at ?? ctx.toCanvas({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
  state.uploading.value += files.length
  const ids: string[] = []
  try {
    await Promise.all(
      files.map(async (file, i) => {
        let src: string
        try {
          src = await upload(file)
        } catch {
          ctx.announce(format(t.imageFailed, { name: file.name }))
          return
        }
        const size = (await naturalSize(src)) ?? { width: MAX_SIDE, height: MAX_SIDE * 0.75 }
        const scale = Math.min(1, MAX_SIDE / Math.max(size.width, size.height))
        const id = ctx.insertNode('image', {
          at: { x: centre.x + i * 24, y: centre.y + i * 24 },
          data: { src, alt: file.name.replace(/\.[^.]+$/, '') },
          size: { width: Math.round(size.width * scale), height: Math.round(size.height * scale) },
          focus: false,
        })
        if (id) ids.push(id)
      }),
    )
  } finally {
    state.uploading.value -= files.length
  }
  if (ids.length > 1) ctx.selection.value = { nodes: ids, edges: [] }
}

/** Opens the file picker and inserts what is picked. */
export function pickImages(ctx: FlowEditorContext, upload?: WhiteboardUpload) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.multiple = true
  input.addEventListener('change', () => {
    const files = imageFiles(input.files)
    if (files.length) void insertImages(ctx, files, upload)
  })
  input.click()
}
