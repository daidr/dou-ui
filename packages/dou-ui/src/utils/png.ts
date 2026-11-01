/** The longest side a canvas takes in every browser, in pixels. */
export const CANVAS_MAX_SIDE = 16384
/** The most pixels a canvas takes in every browser (iOS Safari's limit). */
export const CANVAS_MAX_AREA = 16_777_216

/**
 * The pixel ratio an image of `width` × `height` CSS px is drawn at: the one
 * asked for, lowered until the canvas fits. Throws a `RangeError` when even
 * one pixel per CSS px is too many, so no blurred image is made.
 */
export function fitPixelRatio(width: number, height: number, pixelRatio = 2) {
  const w = Math.max(width, 1)
  const h = Math.max(height, 1)
  const fits = Math.min(
    CANVAS_MAX_SIDE / w,
    CANVAS_MAX_SIDE / h,
    Math.sqrt(CANVAS_MAX_AREA / (w * h)),
  )
  if (fits < 1)
    throw new RangeError(
      `The image would be ${Math.ceil(width)}×${Math.ceil(height)}px, more than a canvas can hold even at pixelRatio 1`,
    )
  return Math.min(pixelRatio, fits)
}

/** Options of `svgToPNG`. */
export interface SvgToPNGOptions {
  /** The image's width, in CSS px. */
  width: number
  /** The image's height, in CSS px. */
  height: number
  /** Pixels per CSS px. 2 by default; lowered when the canvas would be too big. */
  pixelRatio?: number
  /** A color filled under the image; left clear by default. */
  background?: string
}

/**
 * Paints an SVG document on a canvas and returns it as a PNG. Throws a
 * `RangeError` before drawing when the image is too big for a canvas even
 * at one pixel per CSS px (see `fitPixelRatio`).
 */
export async function svgToPNG(svg: string, options: SvgToPNGOptions): Promise<Blob> {
  const { width, height, background } = options
  const ratio = fitPixelRatio(width, height, options.pixelRatio)
  const image = new Image()
  // a data URL, not a blob one: Chrome won't export a canvas that drew
  // `<foreignObject>` from a blob URL
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(width * ratio))
  canvas.height = Math.max(1, Math.floor(height * ratio))
  const ctx = canvas.getContext('2d')!
  ctx.scale(ratio, ratio)
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(image, 0, 0, width, height)
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The PNG could not be made'))),
      'image/png',
    ),
  )
}
