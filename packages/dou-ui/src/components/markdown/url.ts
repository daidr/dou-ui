import { safeUrl } from '../../utils/safe-url'
import type { MarkdownUrlKind } from './markdown'

/**
 * The default check for link, image and source addresses: http(s), mailto,
 * tel, relative addresses and anchors pass; anything else, such as
 * `javascript:` or `data:`, is dropped. Control characters and whitespace
 * are ignored when reading the scheme, so `java\tscript:` is caught too.
 * The same rule as the library's other links. It takes the same arguments
 * as `sanitizeUrl`, so a check of your own can fall back to it.
 */
export function defaultSanitizeUrl(url: string, _kind?: MarkdownUrlKind): string | undefined {
  return safeUrl(url)
}
