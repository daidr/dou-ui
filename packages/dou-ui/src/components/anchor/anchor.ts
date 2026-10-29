import type { ScrollTarget } from '../../utils/scroll'

export interface AnchorItem {
  /** `#` and the id of the heading it points to. */
  href: string
  title: string
  children?: AnchorItem[]
}

export interface AnchorProps {
  items?: AnchorItem[]
  /** The link of the section in view, bound with `v-model`. */
  modelValue?: string
  /**
   * How far below the top of the scroll area a heading counts as reached,
   * in px. Usually the height of a sticky header.
   */
  offset?: number
  /** The scroll area. Defaults to the window. */
  target?: ScrollTarget
  /** Put the link in the address bar when it is clicked. */
  updateHash?: boolean
  /** Names the navigation. Defaults to the locale's "On this page". */
  ariaLabel?: string
}

export interface AnchorEmits {
  'update:modelValue': [href: string]
  /** The section in view changed. */
  change: [href: string]
  click: [event: MouseEvent, item: AnchorItem]
}

export interface AnchorSlots {
  /** Each link's text. */
  item?: (props: { item: AnchorItem; level: number; active: boolean }) => unknown
}

export interface AnchorExpose {
  /** Scroll to a section, as a click on its link would. */
  scrollTo: (href: string) => void
  /** Work out the section in view again, e.g. after the content changed. */
  update: () => void
}
