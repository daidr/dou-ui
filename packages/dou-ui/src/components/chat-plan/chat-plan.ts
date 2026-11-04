/**
 * `waiting` is a step paused on someone else, such as a confirmation from
 * the user or an outside job, as opposed to `pending`, which hasn't started.
 */
export type ChatPlanItemStatus = 'pending' | 'running' | 'waiting' | 'done' | 'skipped' | 'error'

export interface ChatPlanItem {
  /** Unique within the plan. Defaults to the position. */
  key?: string | number
  label: string
  /** A second line under the label. */
  description?: string
  status?: ChatPlanItemStatus
}

export interface ChatPlanProps {
  /** The steps, in order. */
  items?: ChatPlanItem[]
  /** Defaults to the locale's "Plan". */
  title?: string
  /** Let the header fold the list away. Off gives a plain panel that always shows the steps. */
  collapsible?: boolean
  /** Expanded or not. Bound with `v-model:open`; open by default. Ignored when not `collapsible`. */
  open?: boolean
  /**
   * The run is going on now. Off once the turn has ended or been stopped: a
   * `running` step stays the current one but holds still, a solid dot in
   * place of the spinner and no shimmer, so the steps needn't be rewritten.
   */
  live?: boolean
}

export interface ChatPlanEmits {
  'update:open': [open: boolean]
}

export interface ChatPlanSlots {
  /** Replaces the label and description of each item. */
  item?: (props: { item: ChatPlanItem; index: number }) => unknown
}
