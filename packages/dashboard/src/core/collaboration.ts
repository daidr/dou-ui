import type { DashboardTransaction } from './transaction'
import type { DashboardDocument } from './types'

/** What a person is doing to a widget, shared with the others. */
export type DashboardPresenceAction = 'focus' | 'move' | 'resize' | 'settings'

/** What this person is doing, shared with the others; `null` when nothing. */
export interface DashboardPresence {
  widget: string
  action: DashboardPresenceAction
}

/** Another person at a widget. */
export interface DashboardPeer {
  /** Their client id, unique among the people editing. */
  client: number
  name: string
  /** Any CSS color. */
  color: string
  action: DashboardPresenceAction
}

/** What the dashboard hands a collaboration. */
export interface DashboardCollaborationHost {
  /** The document as the dashboard shows it. */
  document: () => DashboardDocument
  /**
   * Shows a document changed by others (`remote`), or by undo and redo of
   * the collaboration's own history. While a widget is being dragged here
   * nothing changes; once it is let go, the dashboard calls `sync`.
   */
  apply: (document: DashboardDocument, origin: 'remote' | 'undo' | 'redo') => void
}

/**
 * Edits a dashboard together with others, given to `DouDashboard` as
 * `collaboration`; made by `collaboration()` from
 * `@dou-ui/dashboard/collaboration`. The dashboard hands it its changes and
 * uses its undo and redo in place of its own.
 */
export interface DashboardCollaboration {
  /** Starts sharing; returns a function that stops. */
  setup: (host: DashboardCollaborationHost) => () => void
  /** A change made here, after the dashboard showed it. */
  transaction: (tr: DashboardTransaction) => void
  /** Hands the dashboard the shared document again (through `apply`), e.g. once a drag ends. */
  sync: () => void
  undo: () => boolean
  redo: () => boolean
  canUndo: () => boolean
  canRedo: () => boolean
  /** Shares what this person is doing. */
  presence?: (presence: DashboardPresence | null) => void
  /** The others at a widget (reactive). */
  peers?: (id: string) => readonly DashboardPeer[]
}
