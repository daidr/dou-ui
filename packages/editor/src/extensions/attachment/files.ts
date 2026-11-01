/** Addresses an attachment may link to: web, relative, and files held in the page. */
export function isSafeFileSrc(src: string): boolean {
  // eslint-disable-next-line no-control-regex
  const value = src.replace(/[\u0000- ]/g, '')
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value)?.[1]?.toLowerCase()
  if (!scheme) return true
  // a data URL is only ever downloaded (the link has `download`), never opened
  return ['http', 'https', 'blob', 'data'].includes(scheme)
}

/** `1.2 MB`, `340 KB`, `12 B`. */
export function formatFileSize(size: unknown): string {
  if (size === '' || size == null) return ''
  const bytes = Number(size)
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1
  return `${value.toFixed(digits)} ${units[unit]}`
}

/** The kind of file, for its icon. */
export function fileKind(
  mime: string,
  name: string,
): 'image' | 'video' | 'audio' | 'archive' | 'text' | 'spreadsheet' | 'other' {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? ''
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (/zip|compressed|tar|rar|7z/.test(mime) || ['zip', 'rar', '7z', 'gz', 'tar'].includes(ext))
    return 'archive'
  if (/sheet|excel|csv/.test(mime) || ['xlsx', 'xls', 'csv'].includes(ext)) return 'spreadsheet'
  if (
    mime.startsWith('text/') ||
    /pdf|word|document|presentation/.test(mime) ||
    ['pdf', 'doc', 'docx', 'txt', 'md', 'ppt', 'pptx'].includes(ext)
  )
    return 'text'
  return 'other'
}
