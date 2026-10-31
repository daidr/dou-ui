import { collaborationColors } from 'dou-ui'
import { h, ref, shallowRef, watch } from 'vue'
import * as Y from 'yjs'
import type { CodeChangeSpec } from '../core/changes'
import { type CodeSelection, mainRange } from '../core/selection'
import type { CodeTransactionResult } from '../core/transaction'
import {
  type CodeDecoration,
  type CodeExtension,
  type CodeExtensionContext,
  type CodeHistoryHandler,
  defineCodeExtension,
} from '../extension'

/** What the editor needs of a Yjs awareness instance (`y-protocols/awareness`). */
export interface AwarenessLike {
  clientID: number
  getLocalState(): Record<string, unknown> | null
  setLocalStateField(field: string, value: unknown): void
  getStates(): Map<number, Record<string, unknown>>
  on(event: 'change', listener: (...args: unknown[]) => void): void
  off(event: 'change', listener: (...args: unknown[]) => void): void
}

/** How the people editing together see each other. */
export interface CollaborationUser {
  name: string
  /** The color of this user's cursor and selection, any CSS color. Picked from the client id when left out. */
  color?: string
}

export interface CollaborationOptions {
  /** Where the text lives, e.g. `ydoc.getText('code')`. */
  text: Y.Text
  /** Shares cursors and selections (`y-protocols/awareness`). Without it, others' cursors are not shown. */
  awareness?: AwarenessLike
  /** This user, shown at their cursor to the others. Needs `awareness`. */
  user?: CollaborationUser
}

export { collaborationColors }

/** What each person shares under the awareness field `code`: their selection, as positions that follow edits. */
interface SharedSelection {
  ranges: Array<{ anchor: unknown; head: unknown }>
  main: number
}

interface Peer {
  client: number
  name: string
  color: string
  selection: SharedSelection
}

/** Marks the steps this binding took from the shared text, so they aren't written back. */
const FROM_SHARED = 'collaboration'

let warnedBreaks = false
/** The editor keeps `\n` only; a `\r` from another client would put every position after it off by one. */
function warnBreaks(insert: string) {
  if (process.env.NODE_ENV === 'production' || warnedBreaks || !insert.includes('\r')) return
  warnedBreaks = true
  console.warn(
    '[@dou-ui/code] the shared text has a "\\r": the editor only keeps "\\n" line breaks, so positions after it no longer match. Write "\\n" only into the Y.Text.',
  )
}

let warnedEmpty = false
/** Filling the shared text from each editor would add one copy per person who opens it at the same time. */
function warnEmpty() {
  if (process.env.NODE_ENV === 'production' || warnedEmpty) return
  warnedEmpty = true
  console.warn(
    '[@dou-ui/code] the shared text is empty, so the editor shows it empty, whatever v-model holds. Write the starting text into the Y.Text once, where the document is created.',
  )
}

/**
 * Edit together through a Yjs text. The text lives in `text`: the
 * editor starts from it, whatever `v-model` holds, and `v-model` then
 * mirrors it; a new `v-model` value is written into it as a change, to
 * everyone. Undo only takes back this user's own changes.
 *
 * One extension per editor: two editors on the same text each need their own.
 */
export function collaboration(options: CollaborationOptions): CodeExtension {
  const { text, awareness, user } = options
  const doc = text.doc
  if (!doc) throw new Error('[@dou-ui/code] collaboration() needs a Y.Text inside a Y.Doc')
  if (awareness && user) {
    const color = user.color ?? collaborationColors[doc.clientID % collaborationColors.length]
    awareness.setLocalStateField('user', { name: user.name, color })
  }
  /** The origin of this editor's own changes, which undo tracks. */
  const origin = { name: 'dou-code-collaboration' }
  const undoManager = new Y.UndoManager(text, {
    trackedOrigins: new Set([origin]),
    captureTimeout: 500,
  })
  const tick = ref(0)
  const bump = () => tick.value++
  undoManager.on('stack-item-added', bump)
  undoManager.on('stack-item-popped', bump)
  undoManager.on('stack-cleared', bump)

  let context: CodeExtensionContext | null = null
  /** The selection before the change being written: undo puts the cursor back there. */
  let before: CodeSelection | null = null

  const relative = (index: number) => Y.createRelativePositionFromTypeIndex(text, index)
  const absolute = (position: Y.RelativePosition) => {
    const found = Y.createAbsolutePositionFromRelativePosition(position, doc)
    return found && found.type === text ? found.index : null
  }
  type Kept = { ranges: Array<[Y.RelativePosition, Y.RelativePosition]>; main: number }
  const keep = (selection: CodeSelection): Kept => ({
    ranges: selection.ranges.map((range) => [relative(range.anchor), relative(range.head)]),
    main: selection.main,
  })

  undoManager.on(
    'stack-item-added',
    (event: { stackItem: { meta: Map<string, unknown> }; type: 'undo' | 'redo' }) => {
      if (!event.stackItem.meta.has('selection') && before)
        event.stackItem.meta.set('selection', keep(before))
    },
  )
  undoManager.on('stack-item-popped', (event: { stackItem: { meta: Map<string, unknown> } }) => {
    const kept = event.stackItem.meta.get('selection') as Kept | undefined
    if (!context || !kept) return
    const ranges = []
    for (const [anchor, head] of kept.ranges) {
      const a = absolute(anchor)
      const b = absolute(head)
      if (a !== null && b !== null) ranges.push({ anchor: a, head: b })
    }
    if (ranges.length) context.select({ ranges, main: Math.min(kept.main, ranges.length - 1) })
  })

  /** Someone else's change, or an undo: into the editor, kept out of its own undo. */
  const observer = (event: Y.YTextEvent, transaction: Y.Transaction) => {
    if (transaction.origin === origin || !context) return
    const specs: CodeChangeSpec[] = []
    let pos = 0
    for (const op of event.delta) {
      if (op.retain) pos += op.retain
      else if (op.delete) {
        specs.push({ from: pos, to: pos + op.delete })
        pos += op.delete
      } else if (typeof op.insert === 'string') {
        warnBreaks(op.insert)
        specs.push({ from: pos, insert: op.insert })
      }
    }
    if (!specs.length) return
    const undo = transaction.origin === undoManager
    const action = undo ? (undoManager.undoing ? 'undo' : 'redo') : 'remote'
    context.transact(
      (tr) => {
        for (const spec of specs) tr.replace(spec.from, spec.to ?? spec.from, spec.insert ?? '')
      },
      { action, history: false, scroll: undo, [FROM_SHARED]: true },
    )
  }

  // ---------------------------------------------------------------- cursors

  const peers = shallowRef<Peer[]>([])
  const readPeers = () => {
    if (!awareness) return
    const out: Peer[] = []
    awareness.getStates().forEach((state, client) => {
      if (client === awareness.clientID) return
      const shared = state.code as SharedSelection | null | undefined
      const who = state.user as { name?: string; color?: string } | undefined
      if (!shared || !Array.isArray(shared.ranges)) return
      out.push({
        client,
        name: who?.name ?? '',
        color: who?.color ?? collaborationColors[client % collaborationColors.length]!,
        selection: shared,
      })
    })
    peers.value = out
  }

  let shared = ''
  const shareSelection = (selection: CodeSelection | null) => {
    if (!awareness) return
    const value: SharedSelection | null = selection && {
      ranges: selection.ranges.map((range) => ({
        anchor: Y.relativePositionToJSON(relative(range.anchor)),
        head: Y.relativePositionToJSON(relative(range.head)),
      })),
      main: selection.main,
    }
    const json = JSON.stringify(value)
    if (json === shared) return
    shared = json
    awareness.setLocalStateField('code', value)
  }

  const resolve = (json: unknown) => {
    try {
      return absolute(Y.createRelativePositionFromJSON(json))
    } catch {
      return null
    }
  }

  const decorations = (ctx: CodeExtensionContext): CodeDecoration[] => {
    // the positions resolve against the text now: follow every change
    const length = ctx.doc.length
    const out: CodeDecoration[] = []
    for (const peer of peers.value) {
      const style = { '--dou-code-peer-color': peer.color }
      peer.selection.ranges.forEach((range, i) => {
        const anchor = resolve(range.anchor)
        const head = resolve(range.head)
        if (anchor === null || head === null || head > length || anchor > length) return
        if (anchor !== head)
          out.push({
            type: 'mark',
            from: Math.min(anchor, head),
            to: Math.max(anchor, head),
            class: 'dou-code-peer-selection',
            style,
          })
        // the name, once per person, on their main cursor
        const named = i === peer.selection.main
        const below = ctx.doc.lineAt(head).number === 1
        out.push({
          type: 'inline',
          pos: head,
          width: 0,
          id: `peer-${peer.client}-${i}`,
          render: () =>
            h(
              'span',
              {
                // a new element when they move (not when the text around moves), so the name shows again
                key: JSON.stringify(range.head),
                class: ['dou-code-peer', below && 'is-below'],
                style,
                'aria-hidden': 'true',
              },
              named && peer.name
                ? h('span', { class: 'dou-code-peer__name' }, peer.name)
                : undefined,
            ),
        })
      })
    }
    return out
  }

  // ---------------------------------------------------------------- history

  const history: CodeHistoryHandler = {
    undo() {
      if (!undoManager.undoStack.length) return false
      before = context?.selection ?? null
      undoManager.undo()
      return true
    },
    redo() {
      if (!undoManager.redoStack.length) return false
      before = context?.selection ?? null
      undoManager.redo()
      return true
    },
    canUndo: () => (void tick.value, undoManager.undoStack.length > 0),
    canRedo: () => (void tick.value, undoManager.redoStack.length > 0),
    close: () => undoManager.stopCapturing(),
  }

  return defineCodeExtension({
    name: 'collaboration',
    setup(ctx) {
      context = ctx
      // the shared text wins over whatever the editor started with
      const current = text.toString()
      if (!current && ctx.doc.length) warnEmpty()
      if (current !== ctx.doc.toString()) {
        warnBreaks(current)
        const head = Math.min(mainRange(ctx.selection).head, current.length)
        ctx.transact((tr) => tr.replace(0, tr.doc.length, current).select(head), {
          action: 'remote',
          history: false,
          scroll: false,
          [FROM_SHARED]: true,
        })
      }
      text.observe(observer)
      awareness?.on('change', readPeers)
      readPeers()
      // the cursor is shared only while this person is in the editor
      const stop = watch(
        () => ctx.focused,
        (focused) => shareSelection(focused ? ctx.selection : null),
        { immediate: true },
      )
      return () => {
        stop()
        text.unobserve(observer)
        awareness?.off('change', readPeers)
        shareSelection(null)
        if (context === ctx) context = null
      }
    },
    update(result: CodeTransactionResult, ctx) {
      if (!result.meta[FROM_SHARED] && !result.changes.empty) {
        before = result.before.selection
        const list = result.changes.changes
        doc.transact(() => {
          // from the end, so the positions before each change still hold
          for (let i = list.length - 1; i >= 0; i--) {
            const change = list[i]!
            if (change.to > change.from) text.delete(change.from, change.to - change.from)
            if (change.insert) text.insert(change.from, change.insert)
          }
        }, origin)
      }
      shareSelection(ctx.focused ? result.state.selection : null)
    },
    decorations: awareness ? decorations : undefined,
    history: () => history,
  })
}
