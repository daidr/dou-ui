import type { Component } from 'vue'

export type ChatStepStatus = 'running' | 'done' | 'error'

export interface ChatStep {
  /** Unique within the list. Defaults to the position. */
  key?: string | number
  /** What the step does, e.g. "Searched the web". */
  label: string
  /** What it was about, e.g. the query or the file name, shown quieter after the label. */
  detail?: string
  /** Defaults to `done`. */
  status?: ChatStepStatus
  /** An icon component for the step. A neutral dot when omitted. */
  icon?: Component
}

export interface ChatStepsProps {
  /** The steps so far, in order. */
  items?: ChatStep[]
  /**
   * The work is going on now. While it is, the summary line names the
   * running step; afterwards it counts the steps. Defaults to whether any
   * step is `running`. Off once the turn has ended or been stopped: a
   * `running` step holds still, a solid dot in place of the spinner.
   */
  live?: boolean
  /** Replaces the summary line. */
  title?: string
  /** Expanded or not. Bound with `v-model:open`; folded by default. */
  open?: boolean
}

export interface ChatStepsEmits {
  'update:open': [open: boolean]
}

export interface ChatStepsSlots {
  /** Replaces each step's text. */
  step?: (props: { step: ChatStep; index: number }) => unknown
  /** Content under each step, e.g. a tool call's result. */
  detail?: (props: { step: ChatStep; index: number }) => unknown
  /** Replaces the summary line. */
  title?: (props: { live: boolean; count: number }) => unknown
}

/**
 * Whether the steps are running, as they show it: `live` when set, else
 * whether a step is `running`. ChatMessage reads the same for `aria-busy`.
 */
export function stepsLive(items: readonly ChatStep[] | undefined, live?: boolean): boolean {
  return live ?? !!items?.some((step) => step.status === 'running')
}
