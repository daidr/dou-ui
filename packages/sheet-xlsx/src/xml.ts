// characters XML 1.0 can't hold, even escaped
// oxlint-disable-next-line no-control-regex
const INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g

/** Text for an XML element's content or attribute. */
export const esc = (text: string) =>
  text
    .replace(INVALID, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Attributes, leaving out the ones without a value. */
export function attrs(list: Record<string, string | number | boolean | undefined | null>) {
  let out = ''
  for (const [name, value] of Object.entries(list)) {
    if (value == null || value === false) continue
    out += ` ${name}="${value === true ? 1 : esc(String(value))}"`
  }
  return out
}

export const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

export const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
export const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
export const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'
