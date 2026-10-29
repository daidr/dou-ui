import type { Size } from '../../utils/types'

export type UploadSize = Size
export type UploadStatus = 'ready' | 'uploading' | 'success' | 'error'
/** `text` lists files in rows; `picture-card` lays them out as square cards, with the trigger as the last card. */
export type UploadListType = 'text' | 'picture-card'
/** Why a file was turned away before it was added. */
export type UploadRejectReason = 'type' | 'size'

export interface UploadFile {
  /** Unique within the list. */
  uid: string
  name: string
  /** In bytes. */
  size?: number
  /** The MIME type. */
  type?: string
  status: UploadStatus
  /** Upload progress, from 0 to 100. */
  percent?: number
  /** The picked file, absent for files listed from the server. */
  raw?: File
  /** Where the file can be seen: a preview made for picked images, or a link from the server. */
  url?: string
  /** What `request` resolved with. */
  response?: unknown
  /** What `request` rejected with. */
  error?: unknown
}

export interface UploadRequestOptions {
  file: UploadFile
  raw: File
  /** Report progress, from 0 to 100. */
  onProgress: (percent: number) => void
  /** Aborted when the file is removed or `abort()` is called. */
  signal: AbortSignal
}

/** Sends one file; resolve when it is stored, reject when it fails. */
export type UploadRequest = (options: UploadRequestOptions) => Promise<unknown>

export interface UploadProps {
  /** The list of files, bound with `v-model`. */
  modelValue?: UploadFile[]
  /** The native `accept`, e.g. `image/*,.pdf`. Dropped files are checked against it too. */
  accept?: string
  multiple?: boolean
  /** Largest file allowed, in bytes. */
  maxSize?: number
  /** Most files the list can hold. */
  maxCount?: number
  disabled?: boolean
  /** A large area files can be dropped onto, instead of a button. */
  dropzone?: boolean
  /** A line under the trigger, e.g. the types and size allowed. */
  hint?: string
  /**
   * Sends a file. DouUI has no network code of its own: bring `fetch`,
   * an SDK or anything else. Without it, files wait in the list as `ready`.
   */
  request?: UploadRequest
  /** Send files as soon as they are picked. Otherwise call `submit()`. */
  autoUpload?: boolean
  /**
   * Runs before a picked file is added. Return `false` to skip it, or a
   * `File` to add instead, e.g. a compressed image.
   */
  beforeUpload?: (file: File) => boolean | File | void | Promise<boolean | File | void>
  /** Show the list of files under the trigger. */
  showList?: boolean
  listType?: UploadListType
  /** In a `picture-card` list, open images in a preview when their card is pressed. */
  preview?: boolean
  size?: UploadSize
}

export interface UploadEmits {
  'update:modelValue': [files: UploadFile[]]
  /** Files were added, removed or changed status. */
  change: [files: UploadFile[]]
  /** Some files did not fit under `maxCount` and were left out. */
  exceed: [files: File[]]
  /** A file was turned away by `accept` or `maxSize`. */
  reject: [file: File, reason: UploadRejectReason]
  success: [file: UploadFile, response: unknown]
  error: [file: UploadFile, error: unknown]
  remove: [file: UploadFile]
  /** The preview of a card was opened. */
  preview: [file: UploadFile]
}

export interface UploadSlots {
  /** Replaces the button. Clicking it opens the file picker. */
  default?: () => unknown
  /** Replaces `hint`. */
  hint?: () => unknown
  /** Replaces a row of the list. */
  file?: (props: { file: UploadFile; remove: () => void; retry: () => void }) => unknown
}

export interface UploadExpose {
  /** Open the file picker. */
  open: () => void
  /** Send every file still `ready` or failed. */
  submit: () => void
  /** Stop sending a file, or every file without a uid. */
  abort: (uid?: string) => void
  /** Send a failed file again. */
  retry: (uid: string) => void
  /** Remove a file from the list, aborting it if it is being sent. */
  remove: (uid: string) => void
}

/** Whether a file matches an `accept` string. */
export function matchesAccept(file: Pick<File, 'name' | 'type'>, accept?: string) {
  if (!accept?.trim()) return true
  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  return accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .some((token) => {
      if (token.startsWith('.')) return name.endsWith(token)
      if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1))
      return type === token
    })
}

/** A size in bytes, in the largest unit that keeps it above 1, e.g. `1.4 MB`. */
export function formatFileSize(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1
  return `${Number(value.toFixed(digits))} ${units[unit]}`
}
