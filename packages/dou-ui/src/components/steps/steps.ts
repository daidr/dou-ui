import type { Component } from 'vue'

export type StepStatus = 'wait' | 'process' | 'finish' | 'error'
export type StepsDirection = 'horizontal' | 'vertical'
export type StepsSize = 'sm' | 'md'

export interface StepItem {
  title: string
  description?: string
  /** Overrides the status worked out from `current`. */
  status?: StepStatus
  /** Shown in the marker instead of the number. */
  icon?: Component
  disabled?: boolean
}

export interface StepsProps {
  items?: StepItem[]
  /** The index of the step in progress, from 0, bound with `v-model:current`. */
  current?: number
  /** The status of the current step, e.g. `error` when it failed. */
  status?: StepStatus
  direction?: StepsDirection
  size?: StepsSize
  /** Let the user jump to a step by clicking it. */
  clickable?: boolean
}

export interface StepsEmits {
  'update:current': [current: number]
  /** A step was clicked. */
  change: [current: number]
}

export interface StepsSlots {
  /** Replaces the title of each step. */
  title?: (props: { item: StepItem; index: number; status: StepStatus }) => unknown
  /** Replaces the description of each step. */
  description?: (props: { item: StepItem; index: number; status: StepStatus }) => unknown
}
