import { indentLines, type BlockOutput } from '../../core/output'
import { blockElement, splitContainer } from '../../core/prepare'
import { calloutTones } from './tones'

/** The alert labels of GitHub's Markdown, and the tone each one reads as. */
const ALERTS: Record<string, string> = {
  NOTE: 'info',
  IMPORTANT: 'info',
  TIP: 'tip',
  WARNING: 'warning',
  CAUTION: 'danger',
}
const LABELS: Record<string, string> = {
  info: 'NOTE',
  tip: 'TIP',
  warning: 'WARNING',
  danger: 'CAUTION',
}
const MARKER = /^\s*\[!(NOTE|IMPORTANT|TIP|WARNING|CAUTION)\][ \t]*\n?/i

const toneOf = (tone: unknown) => (String(tone) in calloutTones ? String(tone) : 'info')

export const calloutOutput: BlockOutput = {
  html: (block, { content, children }) =>
    `<aside data-callout="${toneOf(block.props.tone)}"><p>${content}</p>${children}</aside>`,
  // GitHub's alert syntax: a quote that starts with `[!TIP]`
  markdown: (block, { content, children }) => {
    const head = [`[!${LABELS[toneOf(block.props.tone)]}]`, content].filter(Boolean).join('\n')
    return indentLines(children ? `${head}\n\n${children}` : head, '> ', '> ')
  },
}

/** Take the `[!TIP]` off the start of a quote's text; returns the tone, or null without one. */
function takeMarker(content: Node[]): string | null {
  const first = content.find((node) => node.textContent?.trim())
  if (!(first instanceof Text)) return null
  const match = MARKER.exec(first.data)
  if (!match) return null
  first.data = first.data.slice(match[0].length)
  // the text after the marker starts on the next line
  const index = content.indexOf(first)
  const next = content[index + 1]
  if (!first.data.trim() && next instanceof Element && next.tagName === 'BR') next.remove()
  return ALERTS[match[1]!.toUpperCase()]!
}

/** `<aside data-callout>` from `blocksToHTML`, and quotes that start with `[!TIP]` as Markdown writes them. */
export function prepareCallouts(root: HTMLElement) {
  for (const element of Array.from(root.querySelectorAll('aside[data-callout]'))) {
    const { content, children } = splitContainer(element)
    const tone = toneOf((element as HTMLElement).dataset.callout)
    element.replaceWith(blockElement(element.ownerDocument, 'callout', content, children, { tone }))
  }
  for (const element of Array.from(root.querySelectorAll('blockquote'))) {
    const { content, children } = splitContainer(element)
    const tone = takeMarker(content)
    if (tone)
      element.replaceWith(
        blockElement(element.ownerDocument, 'callout', content, children, { tone }),
      )
  }
  // a quote another extension already turned into a block
  for (const element of Array.from(
    root.querySelectorAll<HTMLElement>('div[data-content-type="quote"]'),
  )) {
    const tone = takeMarker(Array.from(element.childNodes))
    if (tone) {
      element.dataset.contentType = 'callout'
      element.dataset.tone = tone
    }
  }
}
