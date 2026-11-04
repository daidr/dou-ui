import { devWarn } from './status-check'

const SAFE_PROTOCOL = /^(?:https?|mailto|tel):$/i

/**
 * Returns `url` when it is safe to put in `href` or `src`, otherwise `undefined`.
 * http(s), mailto, tel, relative addresses and anchors pass; anything else,
 * such as `javascript:` or `data:`, is dropped. Control characters and
 * whitespace are ignored when reading the scheme, as browsers do, so
 * `java\tscript:` is caught too.
 */
export function safeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
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

/**
 * {@link safeUrl}, warning once while developing when an address is dropped.
 * `component` names the component in the warning, e.g. `DouChatSources`.
 */
export function checkedUrl(component: string, url: string | undefined): string | undefined {
  const safe = safeUrl(url)
  if (url && safe === undefined && process.env.NODE_ENV !== 'production') {
    const shown = url.length > 60 ? `${url.slice(0, 60)}…` : url
    devWarn(
      `[dou-ui] ${component}: \`${shown}\` is not a safe url and is shown without a link. Use http(s), mailto, tel or a relative address.`,
    )
  }
  return safe
}
