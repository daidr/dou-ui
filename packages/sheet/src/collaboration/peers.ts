import { PencilIcon } from '@dou-ui/icons'
import { defineComponent, h, type Component, type Ref, type VNode } from 'vue'
import type { SheetBounds, SheetPoint } from '../core/address'
import { useSheet, type SheetRangeRect } from '../context'

/** A person editing the workbook too, with where they are, in this side's numbers. */
export interface SheetPeer {
  client: number
  name: string
  color: string
  /** The `id` of the sheet they have open. */
  sheet: string
  active: SheetPoint | null
  ranges: SheetBounds[]
  editing: boolean
}

const point = (p: SheetPoint): SheetBounds => ({
  top: p.row,
  left: p.col,
  bottom: p.row,
  right: p.col,
})

/** Edges the view cuts off are not drawn. */
const cutEdges = (cut: SheetRangeRect['cut']) => ({
  borderTopColor: cut.top ? 'transparent' : undefined,
  borderRightColor: cut.right ? 'transparent' : undefined,
  borderBottomColor: cut.bottom ? 'transparent' : undefined,
  borderLeftColor: cut.left ? 'transparent' : undefined,
})

/**
 * A layer that shows the other people on the sheet shown, in their colors:
 * a tint over what they have selected, a ring on their cell with their
 * name beside it, and a pencil while they edit it.
 */
export function createPeers(peers: Ref<SheetPeer[]>): Component {
  return defineComponent({
    name: 'DouSheetPeers',
    setup() {
      const sheet = useSheet()
      return () => {
        const id = sheet.sheet.value.id
        const children: VNode[] = []
        for (const peer of peers.value) {
          if (peer.sheet !== id) continue
          const style = { '--dou-sheet-peer': peer.color }
          peer.ranges.forEach((bounds, i) => {
            // one cell is the ring alone
            if (bounds.top === bounds.bottom && bounds.left === bounds.right) return
            const rect = sheet.rangeRect(bounds)
            if (!rect) return
            children.push(
              h('div', {
                key: `${peer.client}-${i}`,
                class: 'dou-sheet__peer-range',
                style: {
                  ...style,
                  left: `${rect.x}px`,
                  top: `${rect.y}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`,
                  ...cutEdges(rect.cut),
                },
              }),
            )
          })
          const active = peer.active
          // the cell as big as its merge, or only the part out from under the frozen panes
          const shown = active && sheet.rangeRect(point(active))
          if (!active || !shown) continue
          const cut = shown.cut.top || shown.cut.right || shown.cut.bottom || shown.cut.left
          const rect = cut ? shown : (sheet.cellRect(active) ?? shown)
          // the name goes above the cell, or below it at the top of the view
          const above =
            active.row > 0 && !!sheet.rangeRect(point({ ...active, row: active.row - 1 }))
          children.push(
            h(
              'div',
              {
                key: `${peer.client}-active`,
                class: ['dou-sheet__peer-cell', { 'is-editing': peer.editing }],
                style: {
                  ...style,
                  left: `${rect.x}px`,
                  top: `${rect.y}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`,
                  ...cutEdges(shown.cut),
                },
              },
              h('span', { class: ['dou-sheet__peer-name', above ? 'is-above' : 'is-below'] }, [
                peer.editing ? h(PencilIcon, { class: 'dou-sheet__peer-icon' }) : null,
                peer.name,
              ]),
            ),
          )
        }
        return h('div', { class: 'dou-sheet__peers', 'aria-hidden': 'true' }, children)
      }
    },
  })
}
