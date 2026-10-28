import type { ScrollTarget } from '../../utils/scroll'

export interface AffixProps {
  /** Stick once the top comes this close to the top of the scroll area, in px. */
  offsetTop?: number
  /** Stick to the bottom instead, this far from the bottom of the scroll area, in px. */
  offsetBottom?: number
  /** The scroll area. Defaults to the nearest scrolling ancestor, then the window. */
  target?: ScrollTarget
}

export interface AffixEmits {
  /** Fires when the content starts or stops sticking. */
  change: [fixed: boolean]
}

export interface AffixExpose {
  /** Measure again, e.g. after the layout around it changed. */
  update: () => void
}
