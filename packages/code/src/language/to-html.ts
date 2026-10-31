import { type CodeLanguage, languageFor, lineParts, tokenizeLine } from './language'

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (ch) =>
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&quot;',
  )

/**
 * Highlights a whole text as HTML: one `<span class="line">` per line,
 * tokens as `<span class="dou-syntax-…">`, the same classes and colors as
 * the code editor.
 */
export function highlightToHtml(code: string, language: CodeLanguage, tabSize = 2): string {
  const state = language.startState()
  return code
    .split(/\r\n?|\n/)
    .map((text) => {
      const tokens = tokenizeLine(language, text, state, tabSize)
      let html = ''
      for (const [part, type] of lineParts(text, tokens))
        html += type ? `<span class="dou-syntax-${type}">${escape(part)}</span>` : escape(part)
      return `<span class="line">${html}</span>`
    })
    .join('\n')
}

/**
 * A highlighter for `DouCodeBlock` (its `highlight` prop, or once for the
 * whole app in the ConfigProvider's `defaults`) that knows `languages`.
 * A block in another language shows as plain text.
 *
 * ```ts
 * const highlight = createCodeHighlighter([javascript, typescript, css])
 * ```
 */
export function createCodeHighlighter(languages: readonly CodeLanguage[]) {
  return (code: string, lang: string): string => {
    const language = languageFor(languages, lang)
    if (language) return highlightToHtml(code, language)
    return code
      .split(/\r\n?|\n/)
      .map((text) => `<span class="line">${escape(text)}</span>`)
      .join('\n')
  }
}
