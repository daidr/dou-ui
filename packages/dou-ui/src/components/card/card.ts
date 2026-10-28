export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps {
  /** Heading shown in the header. */
  title?: string
  /** Supporting line under the title. */
  description?: string
  /** Space around the body, header and footer. */
  padding?: CardPadding
  /** Lift the card off the page with a soft shadow. Flat by default. */
  raised?: boolean
  /** Deepen the edge on hover, for a card that is a link or a button. */
  interactive?: boolean
  /** The root element, e.g. `article`, `section` or `a`. */
  as?: string
}

export interface CardSlots {
  default?: () => unknown
  /** Replaces the title and description. */
  header?: () => unknown
  /** Placed at the end of the header, e.g. a menu or a status tag. */
  extra?: () => unknown
  /** A bar under the body, set off by a hairline and a faint tint. */
  footer?: () => unknown
}
