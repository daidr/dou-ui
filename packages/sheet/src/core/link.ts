import { parseRange, splitSheet, type SheetRange } from './address'

/*
 * Links. A cell's `link`, or what its `HYPERLINK` formula gives, is a web
 * address or a place in the workbook written `#` and a reference. Only
 * addresses that can't run script are followed.
 */

/** Where a link goes: a web page or app, or cells of the workbook. */
export type SheetLinkTarget =
  { kind: 'web'; href: string } | { kind: 'cell'; sheet?: string; range: SheetRange }

const WEB = /^(?:https?:\/\/|mailto:|tel:)/i
/** Text that reads as a web address, for typed text to become a link. */
const TYPED = /^(?:https?:\/\/|mailto:)[^\s<>"]+$/i

/** Where a link goes, or `null` for one that isn't followed, such as `javascript:`. */
export function linkTarget(link: string | undefined): SheetLinkTarget | null {
  const text = link?.trim()
  if (!text) return null
  if (text.startsWith('#')) {
    const { sheet, ref } = splitSheet(text.slice(1))
    const range = parseRange(ref.replaceAll('$', ''))
    return range ? { kind: 'cell', sheet, range } : null
  }
  if (WEB.test(text)) {
    try {
      return { kind: 'web', href: new URL(text).href }
    } catch {
      return null
    }
  }
  return null
}

/** Whether typed text is a web address, which then becomes the cell's link. */
export const isTypedLink = (text: string) => TYPED.test(text.trim()) && !!linkTarget(text)
