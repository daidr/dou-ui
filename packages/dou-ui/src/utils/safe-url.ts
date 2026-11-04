import { devWarn } from './status-check'

const SAFE_SCHEMES = ['http', 'https', 'mailto', 'tel']

/**
 * The scheme of `url` in lower case, such as `https`, or an empty string for a
 * relative address or anchor. Control characters and whitespace are ignored,
 * as browsers do, so `java\tscript:` reads as `javascript`.
 */
function urlScheme(url: string): string {
  let compact = ''
  for (const ch of url) {
    const code = ch.charCodeAt(0)
    if (code > 0x20 && (code < 0x7f || code > 0x9f)) compact += ch
  }
  const colon = compact.indexOf(':')
  if (colon < 0) return ''
  // a colon after a slash, `?` or `#` belongs to a relative path, not a scheme
  const cut = compact.search(/[/?#]/)
  if (cut >= 0 && cut < colon) return ''
  const scheme = compact.slice(0, colon)
  // not a scheme name, e.g. `2024:年报.html`: browsers read it as a relative path.
  // `compact` drops more characters than browsers do, so a bad character here is
  // in the original too.
  return /^[a-z][a-z0-9+.-]*$/i.test(scheme) ? scheme.toLowerCase() : ''
}

/**
 * Returns `url` when it is safe to use as a link (`href`), otherwise `undefined`.
 * http(s), mailto, tel, relative addresses and anchors pass; anything else,
 * such as `javascript:` or `data:`, is dropped. Only for links: it also drops
 * `data:` and `blob:`, which are fine in an image `src`.
 */
export function safeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  const scheme = urlScheme(url)
  return scheme === '' || SAFE_SCHEMES.includes(scheme) ? url : undefined
}

/** Whether a link should open in a new tab: not for `mailto:` and `tel:`, which hand off to an app. */
export function opensNewTab(url: string): boolean {
  const scheme = urlScheme(url)
  return scheme !== 'mailto' && scheme !== 'tel'
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
