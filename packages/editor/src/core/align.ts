import { warnOnce } from './model'
import type { DOMOutputSpec, Node as PMNode, NodeSpec, TagParseRule } from 'prosemirror-model'

/** How a block's text lines up; `null` (left out of `props`) follows the reading direction. */
export type BlockAlign = 'left' | 'center' | 'right'

export const ALIGNS: readonly BlockAlign[] = ['left', 'center', 'right']

export const isAlign = (value: unknown): value is BlockAlign => ALIGNS.includes(value as BlockAlign)

/**
 * The alignment written on an element: `data-align`, `style="text-align"`
 * or `align`. Left is the reading direction: `null`, as it is stored.
 */
export function alignOf(dom: HTMLElement): BlockAlign | null {
  const value = (dom.dataset?.align || dom.style?.textAlign || dom.getAttribute('align') || '')
    .toLowerCase()
    .replace('start', 'left')
    .replace('end', 'right')
  return isAlign(value) && value !== 'left' ? value : null
}

function withAttrs(spec: DOMOutputSpec, attrs: Record<string, string>): DOMOutputSpec {
  if (!Array.isArray(spec)) return spec
  const [tag, second, ...rest] = spec as unknown as [string, unknown, ...unknown[]]
  if (second && typeof second === 'object' && !Array.isArray(second) && !('nodeType' in second)) {
    const own = second as Record<string, string>
    const style = [own.style, attrs.style].filter(Boolean).join('; ')
    return [tag, { ...own, ...attrs, ...(style ? { style } : {}) }, ...rest] as never
  }
  return [tag, attrs, ...(second === undefined ? [] : [second]), ...rest] as never
}

/**
 * A text block that can be aligned: adds the `align` attribute, reads it
 * from pasted HTML and draws it. Used by paragraphs, headings and quotes;
 * custom text blocks can use it too.
 */
export function alignable(spec: NodeSpec): NodeSpec {
  const toDOM = spec.toDOM
  const normalize = spec.normalizeProps as
    ((attrs: Record<string, unknown>) => Record<string, unknown>) | undefined
  return {
    ...spec,
    // one way to say "left": nothing set; anything else is dropped
    normalizeProps: (attrs: Record<string, unknown>) => {
      const next = normalize ? normalize(attrs) : attrs
      if (next.align === undefined || next.align === null || isAlign(next.align)) {
        return next.align === 'left' ? { ...next, align: null } : next
      }
      warnOnce(`align "${String(next.align)}" is not one of left, center, right; dropped`)
      return { ...next, align: null }
    },
    attrs: { ...spec.attrs, align: { default: null } },
    optionalProps: [...((spec.optionalProps as string[] | undefined) ?? []), 'align'],
    parseDOM: spec.parseDOM?.map((rule) => {
      if (!('tag' in rule)) return rule
      const tagRule = rule as TagParseRule
      return {
        ...tagRule,
        getAttrs: (dom: HTMLElement) => {
          const own = tagRule.getAttrs ? tagRule.getAttrs(dom) : (tagRule.attrs ?? null)
          if (own === false) return false
          return { ...(own ?? tagRule.attrs), align: alignOf(dom) }
        },
      }
    }),
    toDOM: toDOM
      ? (node: PMNode) => {
          const out = toDOM(node)
          const align = node.attrs.align as string | null
          return isAlign(align)
            ? withAttrs(out, { 'data-align': align, style: `text-align: ${align}` })
            : out
        }
      : undefined,
  }
}
