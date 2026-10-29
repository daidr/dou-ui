import type { PreviewImage, PreviewSource } from './image'

export const normalizePreview = (list: PreviewSource = []): PreviewImage[] =>
  list.map((item) => (typeof item === 'string' ? { src: item } : item))

/** Keep `value` within `min` and `max`. */
export const clampScale = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value * 100) / 100))

/** The next zoom step: doubling feels even at every size. */
export const stepScale = (scale: number, direction: 1 | -1) =>
  direction > 0 ? scale * 1.25 : scale / 1.25
