import type { Component } from 'vue'

/** Picks the icon. */
export type ChatArtifactKind = 'document' | 'code' | 'image' | 'web' | 'data' | 'file'
export type ChatArtifactStatus = 'generating' | 'done' | 'error'

export interface ChatArtifactProps {
  /** The name of what was made, e.g. "Trip plan.md". */
  title?: string
  kind?: ChatArtifactKind
  /** A short line under the title, e.g. "Markdown · 1,200 words". */
  description?: string
  status?: ChatArtifactStatus
  /** It is the one shown in the side panel now. */
  active?: boolean
  /** An icon component in place of the kind's icon. */
  icon?: Component
}

export interface ChatArtifactEmits {
  /** The card was pressed, e.g. to show the artifact in a side panel. */
  open: [event: MouseEvent]
}

export interface ChatArtifactSlots {
  /** Replaces the icon. */
  icon?: () => unknown
  /** Buttons at the end, e.g. download. */
  actions?: () => unknown
}
