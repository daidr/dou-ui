import type { IconCategory } from './categories'

/** How an icon is drawn. Only line icons exist for now. */
export type IconVariant = 'stroke'

/**
 * One drawn shape on the 24 × 24 grid: an SVG element name and its geometry
 * attributes. `['dot', { cx, cy }]` draws a round dot slightly heavier than
 * the lines.
 */
export type IconNode = readonly (readonly [
  tag: string,
  attrs: Readonly<Record<string, number | string>>,
])[]

export interface IconProps {
  /** Width and height. A number is read as pixels. Defaults to `1em`, so the icon follows the font size. */
  size?: number | string
  /**
   * Line width; a number is in pixels. By default it follows the size
   * optically: 1.25px at 16px, 1.5px at 24px, 2.25px at 48px.
   */
  strokeWidth?: number | string
  /** Accessible name. Without one the icon is decoration and hidden from assistive technology. */
  label?: string
}

export interface IconMeta {
  /** Kebab-case name, also the file name under `@dou-ui/icons/svg/`. */
  name: string
  /** The exported component, e.g. `SearchIcon`. */
  component: string
  /** A short human name, used in search. */
  label: string
  categories: IconCategory[]
  variant: IconVariant
}
