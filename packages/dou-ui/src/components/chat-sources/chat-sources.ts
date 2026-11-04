export interface ChatSource {
  /** Unique within the list. Defaults to the position. */
  key?: string | number
  title: string
  /**
   * Where the source lives. Without it the source is shown but not linked.
   * Only http(s), mailto, tel and relative addresses become links; others,
   * such as `javascript:`, are shown without a link. http(s) and relative
   * links open in a new tab.
   */
  url?: string
  /** A short name for the site, e.g. `weather.sh.cn`. Defaults to the host of `url`. */
  site?: string
  /** A line of the text it was quoted from, shown in the citation preview. */
  description?: string
  /** A small image for the site, such as its favicon. */
  icon?: string
}

export interface ChatSourcesProps {
  /** The sources, in citation order: the first is `[1]`. */
  items?: ChatSource[]
  /** Show at most this many, followed by a "+N" button that shows the rest. */
  max?: number
}

export interface ChatSourcesSlots {
  /** Replaces the inside of each source. */
  item?: (props: { source: ChatSource; index: number }) => unknown
}

export interface ChatCitationProps {
  /** The number shown, counted from 1. */
  index: number
  /** The source it points to. Shown in a preview on hover or focus. */
  source?: ChatSource
}

/** The host of a URL without `www.`, or an empty string when it does not parse. */
export function sourceSite(source: Pick<ChatSource, 'site' | 'url'>): string {
  if (source.site) return source.site
  if (!source.url) return ''
  try {
    return new URL(source.url).host.replace(/^www\./, '')
  } catch {
    return ''
  }
}
