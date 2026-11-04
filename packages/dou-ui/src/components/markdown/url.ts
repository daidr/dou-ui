import type { MarkdownUrlKind } from './markdown'

const SAFE_PROTOCOL = /^(?:https?|mailto|tel):$/i

/**
 * The default check for link and image addresses: http(s), mailto, tel,
 * relative addresses and anchors pass; anything else, such as
 * `javascript:` or `data:`, is dropped. Control characters and whitespace
 * are ignored when reading the scheme, so `java\tscript:` is caught too.
 * It takes the same arguments as `sanitizeUrl`, so a check of your own can
 * fall back to it.
 */
export function defaultSanitizeUrl(url: string, _kind?: MarkdownUrlKind): string | undefined {
  let compact = ''
  for (const ch of url) {
    const code = ch.charCodeAt(0)
    if (code > 0x20 && (code < 0x7f || code > 0x9f)) compact += ch
  }
  const colon = compact.indexOf(':')
  if (colon < 0) return url
  // a colon after a slash, `?` or `#` belongs to a relative path, not a scheme
  const cut = compact.search(/[/?#]/)
  if (cut >= 0 && cut < colon) return url
  return SAFE_PROTOCOL.test(compact.slice(0, colon + 1)) ? url : undefined
}
