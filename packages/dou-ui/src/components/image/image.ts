export type ImageFit = 'fill' | 'contain' | 'cover' | 'none' | 'scale-down'

export interface PreviewImage {
  src: string
  alt?: string
}

export type PreviewSource = (PreviewImage | string)[]

export interface ImageProps {
  src?: string
  /** Describes the picture. Leave it empty only for decoration. */
  alt?: string
  /** A number is in px. */
  width?: string | number
  height?: string | number
  /** How the picture fills its box. */
  fit?: ImageFit
  /** Load only when the image comes near the viewport (the native `loading="lazy"`). */
  lazy?: boolean
  /** Tried once when `src` fails, before the error state shows. */
  fallback?: string
  /** Open a full-screen preview on click. */
  preview?: boolean
  /** A larger version for the preview. Defaults to `src`. */
  previewSrc?: string
  /** Pictures to page through in the preview, e.g. the whole gallery this image is part of. */
  previewList?: PreviewSource
  /** Where in `previewList` this image is. Defaults to the entry with the same source. */
  previewIndex?: number
  /** Show a download button in the preview. */
  downloadable?: boolean
}

export interface ImageEmits {
  load: [event: Event]
  error: [event: Event]
}

export interface ImageSlots {
  /** Shown while loading. Defaults to a faint shimmer. */
  placeholder?: () => unknown
  /** Shown when the picture cannot be loaded. */
  error?: () => unknown
}

export interface ImagePreviewProps {
  /** Whether it is open, bound with `v-model:open`. */
  open?: boolean
  images?: PreviewSource
  /** The picture shown, bound with `v-model:index`. */
  index?: number
  /** Wrap around from the last picture to the first. */
  loop?: boolean
  minScale?: number
  maxScale?: number
  /** Close when the dark area around the picture is clicked. */
  closeOnMask?: boolean
  teleport?: string | HTMLElement | false
  /**
   * Show a download button. Pictures from another origin download only
   * when it allows it (CORS); otherwise they open in a new tab.
   */
  downloadable?: boolean
}

export interface ImagePreviewEmits {
  'update:open': [value: boolean]
  'update:index': [value: number]
  close: []
}
