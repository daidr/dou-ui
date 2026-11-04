/**
 * Turns code into highlighted HTML. Shaped like shiki's `codeToHtml`, so
 * `(code, lang) => codeToHtml(code, { lang, themes, defaultColor: false })`
 * works as is. Any highlighter fits as long as it returns lines as
 * `<span class="line">…</span>` separated by newlines, with or without a
 * `<pre><code>` around them.
 */
export type CodeBlockHighlighter = (code: string, lang: string) => string | Promise<string>

export interface CodeBlockProps {
  /** The source to show. */
  code?: string
  /** The language, handed to `highlight` and shown in the header when there is no `filename`. */
  lang?: string
  /** Shown in the header. */
  filename?: string
  /**
   * Highlights the code. Defaults to `DouCodeBlock.highlight` in the
   * ConfigProvider's `defaults`, so an app sets it up once. Without one
   * the code shows as plain text.
   */
  highlight?: CodeBlockHighlighter
  /** Number the lines. */
  lineNumbers?: boolean
  /** The number of the first line. */
  startLine?: number
  /** Lines to mark, counted from `startLine`: `[1, 3]` or a string such as `'1,3-5'`. */
  highlightLines?: number[] | string
  /** Wrap long lines instead of scrolling sideways. */
  wrap?: boolean
  /** Fold the block beyond this many lines, with a button to show the rest. */
  maxLines?: number
  /** Show a copy button. */
  copyable?: boolean
  /**
   * The code is still arriving. Only whole lines are highlighted, so the
   * highlighter runs once a line rather than once a character, and new
   * lines fade in.
   */
  streaming?: boolean
  /**
   * The hairline frame and rounded corners. Off, the block takes no border
   * at all, for a card or panel that already has an edge. On by default.
   */
  bordered?: boolean
}

export interface CodeBlockSlots {
  /** Replaces the filename or language in the header. */
  title?: () => unknown
  /** Placed at the end of the header, before the copy button. */
  actions?: () => unknown
}
