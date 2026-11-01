/** What an embed block shows for its link. */
export interface EmbedTarget {
  /** A web page in a frame, or the browser's own video or audio player. */
  kind: 'frame' | 'video' | 'audio'
  /** The address the frame or player loads; it may differ from the link, as for a player page. */
  src: string
  /** Width over height of a frame or video. Default `16 / 9`. */
  aspectRatio?: number
  /** A frame's fixed height in px, instead of `aspectRatio`. */
  height?: number
}

/** Turns a link into what the block shows, or `null` to refuse the link. */
export type EmbedResolver = (url: string) => EmbedTarget | null

const videoTypes = ['mp4', 'webm', 'ogv', 'mov', 'm4v']
const audioTypes = ['mp3', 'wav', 'oga', 'ogg', 'm4a', 'aac', 'flac', 'opus']

/** The link as a URL, when it is an absolute https address. */
export function httpsUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/**
 * The default: https links only. Media files play in the browser's player,
 * any other page shows in a frame. Pages on the editor's own site are
 * refused, as a frame of the same site is not kept apart from the page.
 */
export const resolveEmbed: EmbedResolver = (value) => {
  const url = httpsUrl(value)
  if (!url) return null
  if (typeof location !== 'undefined' && url.origin === location.origin) return null
  const ext = /\.([a-z0-9]+)$/i.exec(url.pathname)?.[1]?.toLowerCase() ?? ''
  if (videoTypes.includes(ext)) return { kind: 'video', src: url.href }
  if (audioTypes.includes(ext)) return { kind: 'audio', src: url.href }
  return { kind: 'frame', src: url.href }
}

/** What frames may do: run scripts, open links in a new tab, go full screen. */
export const frameSandbox =
  'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation allow-forms'
export const frameAllow = 'fullscreen; picture-in-picture; encrypted-media; clipboard-write'

/** A resolver's answer, checked: only https addresses get through. */
export function checkTarget(target: EmbedTarget | null | undefined): EmbedTarget | null {
  if (!target || !['frame', 'video', 'audio'].includes(target.kind)) return null
  const url = httpsUrl(target.src)
  return url ? { ...target, src: url.href } : null
}

export function ratioOf(target: EmbedTarget): number {
  const value = Number(target.aspectRatio)
  return value > 0 ? value : 16 / 9
}
