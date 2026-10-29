export interface ChatReasoningProps {
  /** The model is still thinking: the title shimmers and the panel stays open. */
  thinking?: boolean
  /**
   * How long it thought, in seconds, shown once done. When omitted, the
   * time from `thinking` turning on to turning off is measured.
   */
  duration?: number
  /** Expanded or not. Bound with `v-model:open`; follows `thinking` until toggled. */
  open?: boolean
  /** Fold the panel when thinking ends. */
  autoCollapse?: boolean
  /** Replaces the title, e.g. "Searched 12 pages". */
  title?: string
}

export interface ChatReasoningEmits {
  'update:open': [open: boolean]
}

export interface ChatReasoningSlots {
  /** The reasoning text. */
  default?: () => unknown
  /** Replaces the title. */
  title?: (props: { thinking: boolean; duration: number | undefined }) => unknown
}
