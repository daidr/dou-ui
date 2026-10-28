import { h } from 'vue'
import type { VNode } from 'vue'
import type { Tone } from './types'

const svg = (...children: VNode[]) =>
  h(
    'svg',
    {
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.5,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    },
    children,
  )

/** The icon that stands for each tone in alerts and toasts. */
export function toneIcon(tone: Tone): VNode {
  switch (tone) {
    case 'success':
      return svg(
        h('circle', { cx: 8, cy: 8, r: 6.25 }),
        h('path', { d: 'M5.5 8.2l1.7 1.7 3.3-3.4' }),
      )
    case 'warning':
      return svg(
        h('path', {
          d: 'M7.13 2.5a1 1 0 0 1 1.74 0l5.2 9.25a1 1 0 0 1-.87 1.5H2.8a1 1 0 0 1-.87-1.5z',
        }),
        h('path', { d: 'M8 6.25v2.75M8 11.1v.01' }),
      )
    case 'danger':
      return svg(h('circle', { cx: 8, cy: 8, r: 6.25 }), h('path', { d: 'M8 4.9v3.6M8 11v.01' }))
    default:
      return svg(h('circle', { cx: 8, cy: 8, r: 6.25 }), h('path', { d: 'M8 7.25V11M8 5v.01' }))
  }
}
