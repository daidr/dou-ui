export type EmptySize = 'sm' | 'md'

export interface EmptyProps {
  /** The headline. Defaults to the locale's "no data" when there is no description either. */
  title?: string
  /** A line explaining why it is empty or what to do next. */
  description?: string
  /** `sm` for inside a table, list or menu; `md` for a whole page or card. */
  size?: EmptySize
}

export interface EmptySlots {
  /** Replaces the icon. */
  icon?: () => unknown
  /** Replaces the title. */
  title?: () => unknown
  /** Replaces the description. */
  description?: () => unknown
  /** Actions under the text, e.g. a button that creates the first item. */
  default?: () => unknown
}
