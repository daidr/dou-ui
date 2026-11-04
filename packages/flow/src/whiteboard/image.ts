import { toast } from 'dou-ui'
import type { FlowEditorContext } from '../context'
import type { Point } from '../core/model'
import { format } from '../locale'
import { boardState } from './state'

/**
 * Turns a file into the `src` an image node keeps, e.g. by uploading it.
 * Return `{ src, alt }` to give the image its description; it is the file's
 * name otherwise.
 */
export type WhiteboardUpload = (file: File) => WhiteboardUploaded | Promise<WhiteboardUploaded>

/** An image's address, or its address and description. */
export type WhiteboardUploaded = string | { src: string; alt?: string }

/**
 * Called for each image whose upload threw or rejected, with what it threw
 * and the file. Giving it replaces the built-in error toast, and the app
 * then tells the user, screen readers included, in its own way.
 */
export type WhiteboardUploadError = (error: unknown, file: File) => void

export interface WhiteboardImageOptions {
  /** Where the images go, in canvas units; the middle of the view by default. */
  at?: Point
  /** Overrides the kit's `upload` option for these images. */
  upload?: WhiteboardUpload
  /** Overrides the kit's `onUploadError` option for these images. */
  onUploadError?: WhiteboardUploadError
}

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
 * Adds an image node for each file, centred on `at` and stepped down and
 * right when there are several. Files go through the kit's `upload` option.
 */
export async function insertImages(
  ctx: FlowEditorContext,
  files: File[],
  options: WhiteboardImageOptions = {},
) {
  const state = boardState(ctx)
  const upload = options.upload ?? state.upload ?? readAsDataUrl
  const onUploadError = options.onUploadError ?? state.onUploadError
  const at = options.at
  const t = ctx.messages.value.board
  const root = ctx.root.value
  if (!root || ctx.readonly.value) return
  const box = root.getBoundingClientRect()
  const centre = at ?? ctx.toCanvas({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
  state.uploading.value += files.length
  const ids: string[] = []
  const failed: File[] = []
  try {
    await Promise.all(
      files.map(async (file, i) => {
        let src: string
        let alt = file.name.replace(/\.[^.]+$/, '')
        try {
          const done = await upload(file)
          if (typeof done === 'string') src = done
          else {
            src = done.src
            if (done.alt !== undefined) alt = done.alt
          }
        } catch (error) {
          failed.push(file)
          try {
            onUploadError?.(error, file)
          } catch (thrown) {
            // the other images still go in
            console.error(thrown)
          }
          return
        }
        const size = (await naturalSize(src)) ?? { width: MAX_SIDE, height: MAX_SIDE * 0.75 }
        const scale = Math.min(1, MAX_SIDE / Math.max(size.width, size.height))
        const id = ctx.insertNode('image', {
          at: { x: centre.x + i * 24, y: centre.y + i * 24 },
          data: { src, alt },
          size: { width: Math.round(size.width * scale), height: Math.round(size.height * scale) },
          focus: false,
        })
        if (id) ids.push(id)
      }),
    )
  } finally {
    state.uploading.value -= files.length
  }
  // one toast for the whole drop; it is an alert, so screen readers hear it
  // too. At the bottom, so it never covers the board's toolbar for a retry.
  if (failed.length && !onUploadError) {
    toast.danger(
      failed.length === 1
        ? format(t.imageFailed, { name: failed[0]!.name })
        : format(t.imagesFailed, { count: failed.length }),
      { placement: 'bottom' },
    )
  }
  if (ids.length > 1) ctx.selection.value = { nodes: ids, edges: [] }
}

/** Opens the file picker and inserts what is picked, as `insertImages` does. */
export function pickImages(ctx: FlowEditorContext, options: WhiteboardImageOptions = {}) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.multiple = true
  input.addEventListener('change', () => {
    const files = imageFiles(input.files)
    if (files.length) void insertImages(ctx, files, options)
  })
  input.click()
}
