import { downloadBlob } from '../../utils/download'
import type { PreviewImage, PreviewSource } from './image'

export const normalizePreview = (list: PreviewSource = []): PreviewImage[] =>
  list.map((item) => (typeof item === 'string' ? { src: item } : item))

/** Keep `value` within `min` and `max`. */
export const clampScale = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value * 100) / 100))

/** The next zoom step: doubling feels even at every size. */
export const stepScale = (scale: number, direction: 1 | -1) =>
  direction > 0 ? scale * 1.25 : scale / 1.25

/** Opens a link to save, for a picture that can't be fetched. */
function save(href: string, name: string) {
  const link = document.createElement('a')
  link.href = href
  link.download = name
  link.target = '_blank'
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
}

/**
 * Save a picture under the last part of its path. It is fetched first so
 * the browser saves it rather than opening it; when that is not allowed
 * (another origin without CORS) the link opens it instead.
 */
export async function downloadImage(src: string) {
  const url = new URL(src, location.href)
  const name = decodeURIComponent(url.pathname.split('/').pop() || '') || 'image'
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(String(response.status))
    downloadBlob(await response.blob(), name)
  } catch {
    save(url.href, name)
  }
}
