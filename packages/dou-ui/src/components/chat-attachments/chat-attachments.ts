export type ChatAttachmentStatus = 'running' | 'done' | 'error'

export interface ChatAttachment {
  /** Unique within the list. */
  uid: string
  name: string
  /** In bytes. */
  size?: number
  /** The MIME type. Picks the file icon, and marks images to show as thumbnails. */
  type?: string
  /** A link or object URL. Images with one are shown as thumbnails. */
  url?: string
  /** Leave out once the file is ready. */
  status?: ChatAttachmentStatus
  /** Upload progress, from 0 to 100, while `running`. */
  percent?: number
}

export interface ChatAttachmentsProps {
  /** The attachments, bound with `v-model`. */
  modelValue?: ChatAttachment[]
  /** Show a remove button on each. Turn off for a message already sent. */
  removable?: boolean
}

export interface ChatAttachmentsEmits {
  'update:modelValue': [files: ChatAttachment[]]
  /** An attachment was removed. */
  remove: [file: ChatAttachment]
  /** An attachment was pressed, e.g. to preview it. */
  open: [file: ChatAttachment]
}

export interface ChatAttachmentsSlots {
  /** Replaces the inside of each attachment. */
  item?: (props: { file: ChatAttachment; remove: () => void }) => unknown
}

/** The upper-cased extension of a file name, e.g. `PDF`; empty when there is none. */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toUpperCase() : ''
}

export type ChatAttachmentKind =
  'image' | 'video' | 'audio' | 'archive' | 'code' | 'spreadsheet' | 'text' | 'file'

const byExtension: Record<string, ChatAttachmentKind> = {
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  gz: 'archive',
  tar: 'archive',
  js: 'code',
  ts: 'code',
  vue: 'code',
  json: 'code',
  html: 'code',
  css: 'code',
  py: 'code',
  go: 'code',
  rs: 'code',
  java: 'code',
  xls: 'spreadsheet',
  xlsx: 'spreadsheet',
  csv: 'spreadsheet',
  numbers: 'spreadsheet',
  txt: 'text',
  md: 'text',
  pdf: 'text',
  doc: 'text',
  docx: 'text',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  avif: 'image',
  svg: 'image',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  flac: 'audio',
}

/** What kind of file it is, from the MIME type and then the extension. */
export function attachmentKind(file: Pick<ChatAttachment, 'name' | 'type'>): ChatAttachmentKind {
  const type = file.type ?? ''
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('audio/')) return 'audio'
  return (
    byExtension[fileExtension(file.name).toLowerCase()] ??
    (type.startsWith('text/') ? 'text' : 'file')
  )
}
