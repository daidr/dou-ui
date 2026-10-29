const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Plain code as one `<span class="line">` per line. */
export function plainLines(code: string): string[] {
  return code.split('\n').map((line) => `<span class="line">${escape(line)}</span>`)
}

/**
 * Split highlighted HTML into lines. Shiki writes each line as a
 * `<span class="line">` and puts a newline between them, and no token
 * ever holds a newline, so the HTML inside `<code>` splits cleanly.
 */
export function htmlLines(html: string): string[] {
  const code = /<code[^>]*>([\s\S]*)<\/code>/.exec(html)
  return (code ? code[1]! : html).replace(/\n$/, '').split('\n')
}

/** Line numbers from `[1, 3]` or `'1,3-5'`. */
export function parseLines(value: number[] | string | undefined): Set<number> {
  if (Array.isArray(value)) return new Set(value)
  const result = new Set<number>()
  for (const part of (value ?? '').replace(/[{}\s]/g, '').split(',')) {
    const [from, to = from] = part.split('-').map(Number)
    if (!Number.isInteger(from) || !Number.isInteger(to)) continue
    for (let line = from!; line <= to!; line++) result.add(line)
  }
  return result
}
