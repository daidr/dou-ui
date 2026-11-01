/** The longest side a canvas takes in every browser, in pixels. */
export const CANVAS_MAX_SIDE = 16384

/**
 * The most pixels a canvas takes here: about 16.7 million on iPhone and
 * iPad (every browser there is Safari underneath), 16384 × 16384 elsewhere.
 */
export function canvasMaxArea() {
  const touchSafari =
    typeof window !== 'undefined' && 'GestureEvent' in window && navigator.maxTouchPoints > 0
  return touchSafari ? 16_777_216 : CANVAS_MAX_SIDE * CANVAS_MAX_SIDE
}

/** Who exports the image, for its error messages. */
export interface PNGExportSource {
  /** The package, put before messages as `[scope]`, like `@dou-ui/chart`. */
  scope?: string
  /** What to do when the image is too big, added to that error. */
  hint?: string
}

const prefix = (source: PNGExportSource) => (source.scope ? `[${source.scope}] ` : '')

const positive = (value: number) => Number.isFinite(value) && value > 0

/**
 * The pixel ratio an image of `width` × `height` CSS px is drawn at: the one
 * asked for, lowered until the canvas fits. Throws a `RangeError` when even
 * one pixel per CSS px is too many, so no blurred image is made, and when
 * the size or the ratio isn't a positive number.
 */
export function fitPixelRatio(
  width: number,
  height: number,
  pixelRatio = 2,
  source: PNGExportSource = {},
) {
  if (!positive(width) || !positive(height))
    throw new RangeError(`${prefix(source)}The image size ${width}×${height} isn't positive`)
  if (!positive(pixelRatio))
    throw new RangeError(`${prefix(source)}pixelRatio must be a positive number, not ${pixelRatio}`)
  const fits = Math.min(
    CANVAS_MAX_SIDE / width,
    CANVAS_MAX_SIDE / height,
    Math.sqrt(canvasMaxArea() / (width * height)),
  )
  if (fits < 1)
    throw new RangeError(
      `${prefix(source)}The image would be ${Math.ceil(width)}×${Math.ceil(height)}px, more than a canvas can hold even at pixelRatio 1` +
        (source.hint ? `; ${source.hint}` : ''),
    )
  return Math.min(pixelRatio, fits)
}

/** Options of `svgToPNG`. */
export interface SvgToPNGOptions extends PNGExportSource {
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
  const ratio = fitPixelRatio(width, height, options.pixelRatio, options)
  const image = new Image()
  // a data URL, not a blob one: Chrome won't export a canvas that drew
  // `<foreignObject>` from a blob URL
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  try {
    await image.decode()
  } catch (error) {
    throw new Error(
      `${prefix(options)}The SVG could not be drawn as an image; it may not be well-formed XML (an unclosed tag, an unescaped "&" or "<" in text)`,
      { cause: error },
    )
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(width * ratio))
  canvas.height = Math.max(1, Math.floor(height * ratio))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(`${prefix(options)}The browser gave no canvas to draw the image on`)
  ctx.scale(ratio, ratio)
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(image, 0, 0, width, height)
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error(`${prefix(options)}The canvas could not be saved as PNG`)),
      'image/png',
    ),
  )
}
