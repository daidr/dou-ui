export type ChatPlanItemStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error'

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
  /** Expanded or not. Bound with `v-model:open`; open by default. */
  open?: boolean
}

export interface ChatPlanEmits {
  'update:open': [open: boolean]
}

export interface ChatPlanSlots {
  /** Replaces the label and description of each item. */
  item?: (props: { item: ChatPlanItem; index: number }) => unknown
}
