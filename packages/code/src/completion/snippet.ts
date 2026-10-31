/** A place in a snippet to fill in, `from`–`to` in its text. */
export interface SnippetField {
  /** Its number: Tab goes through them in order, `0` last. */
  index: number
  from: number
  to: number
}

/**
 * Reads a snippet: `${1:name}` is field 1 holding `name`, `$1` or `${1}`
 * field 1 again (holding the same), and `$0` where the cursor ends. Every
 * place of a field is filled in together. `\$` and `\}`
 * are the characters themselves.
 */
export function parseSnippet(source: string): { text: string; fields: SnippetField[] } {
  let text = ''
  const fields: SnippetField[] = []
  const open: Array<{ index: number; from: number }> = []
  // What each numbered field holds, so a bare `$1` repeats it.
  const defaults = new Map<number, string>()
  for (const match of source.matchAll(/(?<!\\)\$\{(\d+):([^${}\\]*)\}/g))
    if (!defaults.has(Number(match[1]))) defaults.set(Number(match[1]), match[2]!)
  const mirror = (index: number) => {
    const from = text.length
    text += defaults.get(index) ?? ''
    fields.push({ index, from, to: text.length })
  }
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!
    if (ch === '\\' && (source[i + 1] === '$' || source[i + 1] === '}' || source[i + 1] === '\\')) {
      text += source[++i]
      continue
    }
    if (ch === '$') {
      const plain = /^\d+/.exec(source.slice(i + 1))
      if (plain) {
        mirror(Number(plain[0]))
        i += plain[0].length
        continue
      }
      const braced = /^\{(\d+)(:|\})/.exec(source.slice(i + 1))
      if (braced) {
        i += braced[0].length
        if (braced[2] === '}') mirror(Number(braced[1]))
        else open.push({ index: Number(braced[1]), from: text.length })
        continue
      }
    }
    if (ch === '}' && open.length) {
      const field = open.pop()!
      fields.push({ index: field.index, from: field.from, to: text.length })
      continue
    }
    text += ch
  }
  // Unclosed fields end where the text does.
  for (const field of open) fields.push({ index: field.index, from: field.from, to: text.length })
  // In Tab order: 1, 2, … and 0 (or the end) last.
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  fields.sort((a, b) => (a.index || Infinity) - (b.index || Infinity) || a.from - b.from)
  return { text, fields }
}
