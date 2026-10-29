export type ImageCropperShape = 'rect' | 'round'

export interface ImageCropperProps {
  /** The image: a URL, or a `File` / `Blob`, e.g. one just picked for upload. */
  src?: string | Blob | null
  /** Width divided by height of the crop frame. */
  aspectRatio?: number
  /** `round` masks the frame as a circle (or an ellipse). The output stays a rectangle. */
  shape?: ImageCropperShape
  /** Height of the cropping area; a number is in px. It fills the width it is given. */
  height?: number | string
  /** How far the image can be zoomed in, as a multiple of the smallest zoom that still fills the frame. */
  maxZoom?: number
  /** Show the zoom slider and the rotate buttons under the image. */
  toolbar?: boolean
  /** For images from another origin, which the canvas can only read with CORS. */
  crossOrigin?: '' | 'anonymous' | 'use-credentials'
  disabled?: boolean
}

/** The part of the image inside the frame, in pixels of the image after rotating it. */
export interface ImageCropperArea {
  x: number
  y: number
  width: number
  height: number
  /** Clockwise rotation in degrees: 0, 90, 180 or 270. */
  rotate: number
}

export interface ImageCropperEmits {
  /** The image loaded, with its natural size. */
  ready: [size: { width: number; height: number }]
  /** The image failed to load. */
  error: [event: Event]
  /** The crop area changed: after a drag, a zoom or a rotation. */
  change: [area: ImageCropperArea]
}

export interface ImageCropperOutputOptions {
  /** Width of the output in px. Defaults to the crop area's size in the image, capped by `maxWidth`. */
  width?: number
  /** Caps the default width, so a large photo does not make a huge avatar. */
  maxWidth?: number
  /** Fills what the image does not cover, e.g. `#fff` for a JPEG. Transparent by default. */
  background?: string
}

export interface ImageCropperBlobOptions extends ImageCropperOutputOptions {
  /** e.g. `image/png` (the default), `image/jpeg` or `image/webp`. */
  type?: string
  /** 0–1, for lossy types. */
  quality?: number
}

export interface ImageCropperExpose {
  /** Draw the crop onto a new canvas. `null` until the image has loaded. */
  getCanvas: (options?: ImageCropperOutputOptions) => HTMLCanvasElement | null
  /** The crop as an image file, e.g. to upload. */
  getBlob: (options?: ImageCropperBlobOptions) => Promise<Blob | null>
  /** The crop area, in pixels of the rotated image. */
  getArea: () => ImageCropperArea | null
  /** Turn the image by a multiple of 90 degrees; positive is clockwise. */
  rotate: (degrees: number) => void
  /** Set the zoom, from 1 (fills the frame) to `maxZoom`. */
  zoomTo: (zoom: number) => void
  /** Center the image and zoom out again, keeping the rotation at 0. */
  reset: () => void
}
