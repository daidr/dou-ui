export interface PageHeaderProps {
  /** The page's name. */
  title?: string
  /** A quieter line beside the title, e.g. an id or a status. */
  subtitle?: string
  /** Show the back button before the title. */
  showBack?: boolean
  /** The back button's text. Defaults to the locale's "返回". */
  backText?: string
  /** The heading level of the title, so the header fits the page outline. */
  level?: 1 | 2 | 3 | 4 | 5 | 6
}

export interface PageHeaderEmits {
  /** The back button was pressed. */
  back: [event: MouseEvent]
}

export interface PageHeaderSlots {
  /** Above the title row, usually a breadcrumb. */
  breadcrumb?: () => unknown
  /** Replaces the back arrow. */
  icon?: () => unknown
  title?: () => unknown
  subtitle?: () => unknown
  /** Actions at the end of the title row. */
  extra?: () => unknown
  /** Under the title row, e.g. a description or a row of statistics. */
  default?: () => unknown
}
