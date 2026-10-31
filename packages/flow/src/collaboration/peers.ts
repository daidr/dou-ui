import { defineComponent, h, onBeforeUnmount, shallowRef, type Component, type VNode } from 'vue'
import { useFlowEditor } from '../context'
import type { FlowSelection, Rect } from '../core/model'

/** The part of an `Awareness` (`y-protocols/awareness`) the editor uses. */
export interface AwarenessLike {
  clientID: number
  getLocalState(): Record<string, unknown> | null
  setLocalStateField(field: string, value: unknown): void
  getStates(): Map<number, Record<string, unknown>>
  on(event: 'change', listener: (...args: unknown[]) => void): void
  off(event: 'change', listener: (...args: unknown[]) => void): void
}

/** What each person shares under the awareness field `flow`. */
export interface FlowPresence {
  /** The nodes they are dragging or resizing, where they would land. */
  moving: ({ id: string } & Rect)[]
  selection: FlowSelection
  /** The edge they are drawing, as an SVG path in canvas coordinates. */
  path: string | null
}

interface Peer {
  client: number
  name: string
  color: string
  presence: FlowPresence
}

function box(key: string, rect: Rect, kind: string, name?: string) {
  return h(
    'div',
    {
      key,
      class: ['dou-flow-peer', `is-${kind}`],
      style: {
        transform: `translate(${rect.x}px, ${rect.y}px)`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      },
    },
    // the name, once per person
    name ? h('span', { class: 'dou-flow-peer__name' }, name) : undefined,
  )
}

/**
 * A layer that shows what other people are doing, in their colors: dashed
 * outlines where the nodes they drag would land, outlines around what they
 * have selected, and the edge they are drawing.
 */
export function createPeers(awareness: AwarenessLike): Component {
  return defineComponent({
    name: 'DouFlowPeers',
    setup() {
      const ctx = useFlowEditor()
      const states = shallowRef<Peer[]>([])
      const read = () => {
        const out: Peer[] = []
        awareness.getStates().forEach((state, client) => {
          if (client === awareness.clientID) return
          const user = state.user as { name?: string; color?: string } | undefined
          const presence = state.flow as FlowPresence | null | undefined
          if (!user || !presence) return
          out.push({ client, name: user.name ?? '', color: user.color ?? 'currentColor', presence })
        })
        states.value = out
      }
      read()
      awareness.on('change', read)
      onBeforeUnmount(() => awareness.off('change', read))

      return () =>
        states.value.map((peer) => {
          const { presence } = peer
          const moving = new Set(presence.moving.map((item) => item.id))
          const children: VNode[] = []
          let named = false
          const label = () => (named ? undefined : ((named = true), peer.name))
          for (const item of presence.moving)
            children.push(box(`m-${item.id}`, item, 'moving', label()))
          for (const id of presence.selection?.nodes ?? []) {
            const rect = !moving.has(id) && ctx.getNodeRect(id)
            if (rect) children.push(box(`s-${id}`, rect, 'selected', label()))
          }
          if (presence.path)
            children.push(
              h('svg', { key: 'path', class: 'dou-flow-peer__lines', 'aria-hidden': 'true' }, [
                h('path', { d: presence.path }),
              ]),
            )
          return h(
            'div',
            {
              key: peer.client,
              class: 'dou-flow-peers',
              style: { '--dou-flow-peer-color': peer.color },
            },
            children,
          )
        })
    },
  })
}
