import type { Component } from 'vue'

export interface ChatSuggestion {
  /** Handed to `select`. Defaults to `label`. */
  value?: string
  label: string
  /** A second line, shown in the `card` variant. */
  description?: string
  /** An icon component drawn before the label. */
  icon?: Component
  disabled?: boolean
}

/** `chip` lines up small pills that wrap; `card` lays out larger cards in a grid. */
export type ChatSuggestionsVariant = 'chip' | 'card'

export interface ChatSuggestionsProps {
  /** The suggestions; a string is a suggestion with that label. */
  items?: (string | ChatSuggestion)[]
  variant?: ChatSuggestionsVariant
  /** Cards per row in the `card` variant. Fits as many as there is room for when omitted. */
  columns?: number
  /** A line above the suggestions, e.g. "Try asking". */
  title?: string
}

export interface ChatSuggestionsEmits {
  /** A suggestion was picked. */
  select: [value: string, item: ChatSuggestion]
}

export interface ChatSuggestionsSlots {
  /** Replaces the inside of each suggestion. */
  item?: (props: { item: ChatSuggestion }) => unknown
  /** Replaces the title. */
  title?: () => unknown
}
