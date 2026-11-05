import type { Component } from 'vue'

/**
 * `waiting` means the same as in ChatConfirm: paused until the person
 * answers. `withdrawn` means the assistant no longer needs an answer, e.g.
 * the run was stopped or things changed before the person replied.
 */
export type ChatQuestionStatus = 'waiting' | 'answered' | 'withdrawn'

export interface ChatQuestionOption {
  /** Handed to `select`, and what `answer` names to show the choice; unique among the options. */
  value: string | number
  label: string
  /** A second line under the label. */
  description?: string
  /** An icon component drawn before the label. */
  icon?: Component
  disabled?: boolean
}

export interface ChatQuestionProps {
  /** The question, e.g. "Which store should the schedule cover?". */
  title?: string
  /** More about the question; once withdrawn, a good place for the reason. */
  description?: string
  /** The choices offered. */
  options?: ChatQuestionOption[]
  /** `waiting` asks; the others show how it ended in one quiet line. */
  status?: ChatQuestionStatus
  /** The `value` of the option chosen, shown once `answered`. */
  answer?: string | number
}

export interface ChatQuestionEmits {
  /** An option was pressed. Setting `answer` and `status` to `answered` is up to you. */
  select: [value: string | number, option: ChatQuestionOption]
}

export interface ChatQuestionSlots {
  /** Replaces the icon. */
  icon?: () => unknown
  /** Replaces the title. */
  title?: () => unknown
  /** Replaces the inside of an option. */
  option?: (props: { option: ChatQuestionOption }) => unknown
}
