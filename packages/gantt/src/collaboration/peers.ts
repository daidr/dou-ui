import { computed, defineComponent, h, onBeforeUnmount, shallowRef, type Component } from 'vue'
import { useGantt } from '../context'
import { spanOf } from '../core/model'

/** The part of an `Awareness` (`y-protocols/awareness`) the chart uses. */
export interface AwarenessLike {
  clientID: number
  getLocalState(): Record<string, unknown> | null
  setLocalStateField(field: string, value: unknown): void
  getStates(): Map<number, Record<string, unknown>>
  on(event: 'change', listener: (...args: unknown[]) => void): void
  off(event: 'change', listener: (...args: unknown[]) => void): void
}

/** What each person shares under the awareness field `gantt`. */
export interface GanttPresence {
  /** The tasks they are dragging, with the dates they would get. */
  moving: { id: string; start?: string; end?: string }[]
  selection: string[]
}

interface Peer {
  client: number
  name: string
  color: string
  presence: GanttPresence
}

/** A layer that outlines the tasks other people are dragging or have selected, in their colors. */
export function createPeers(awareness: AwarenessLike): Component {
  return defineComponent({
    name: 'DouGanttPeers',
    setup() {
      const ctx = useGantt()
      const states = shallowRef<Peer[]>([])
      const read = () => {
        const out: Peer[] = []
        awareness.getStates().forEach((state, client) => {
          if (client === awareness.clientID) return
          const user = state.user as { name?: string; color?: string } | undefined
          const presence = state.gantt as GanttPresence | null | undefined
          if (!user || !presence) return
          out.push({ client, name: user.name ?? '', color: user.color ?? 'currentColor', presence })
        })
        states.value = out
      }
      read()
      awareness.on('change', read)
      onBeforeUnmount(() => awareness.off('change', read))

      const rowById = computed(() => new Map(ctx.rows.value.map((row) => [row.task.id, row])))

      /** Where a task's bar is, with `patch` applied: in timeline px. */
      function box(id: string, patch?: { start?: string; end?: string }) {
        const row = rowById.value.get(id)
        if (!row) return null
        const span = patch ? spanOf({ ...row.task, ...patch }) : row.span
        const top = ctx.rowTop(id)
        if (!span || top == null) return null
        const left = ctx.xOf(span.start)!
        return {
          left,
          width: Math.max(2, ctx.xOf(span.end)! - left),
          top,
          milestone: row.milestone,
        }
      }

      return () =>
        states.value.flatMap((peer) => {
          const style = { '--dou-gantt-peer-color': peer.color }
          const moving = new Set(peer.presence.moving.map((item) => item.id))
          const outlines = [
            ...peer.presence.moving.map((item) => ({ ...box(item.id, item), kind: 'moving' })),
            ...peer.presence.selection
              .filter((id) => !moving.has(id))
              .map((id) => ({ ...box(id), kind: 'selected' })),
          ].filter((item): item is NonNullable<ReturnType<typeof box>> & { kind: string } =>
            Number.isFinite(item.left),
          )
          return outlines.map((item, i) =>
            h(
              'div',
              {
                key: `${peer.client}-${item.kind}-${i}`,
                class: ['dou-gantt__peer', `is-${item.kind}`, { 'is-milestone': item.milestone }],
                style: {
                  ...style,
                  transform: `translate(${item.left}px, ${item.top}px)`,
                  width: item.milestone ? undefined : `${item.width}px`,
                },
              },
              // the name, once per person
              i === 0 ? h('span', { class: 'dou-gantt__peer-name' }, peer.name) : undefined,
            ),
          )
        })
    },
  })
}
