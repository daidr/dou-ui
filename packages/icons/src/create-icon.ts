import { defineComponent, h } from 'vue'
import type { PropType } from 'vue'
import type { IconNode } from './types'

const pascal = (name: string) =>
  name.replace(/(^|-)([a-z0-9])/g, (_, __: string, char: string) => char.toUpperCase())

/** Dots are a touch heavier than lines so they read as dots, not specks. */
const DOT_WEIGHT = 1.5

/**
 * Turn drawn shapes on the 24 × 24 grid into a Vue component. Every icon in
 * the set is made with this, and so can your own.
 */
export function createIcon(name: string, node: IconNode) {
  return defineComponent({
    name: `${pascal(name)}Icon`,
    props: {
      size: { type: [Number, String] as PropType<number | string>, default: '1em' },
      strokeWidth: { type: [Number, String] as PropType<number | string>, default: 1.5 },
      label: String,
    },
    setup(props) {
      return () =>
        h(
          'svg',
          {
            xmlns: 'http://www.w3.org/2000/svg',
            width: props.size,
            height: props.size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': props.strokeWidth,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            role: props.label ? 'img' : undefined,
            'aria-label': props.label || undefined,
            'aria-hidden': props.label ? undefined : 'true',
          },
          node.map(([tag, attrs]) =>
            tag === 'dot'
              ? h('path', {
                  d: `M${attrs.cx} ${attrs.cy}h.01`,
                  'stroke-width': Number(props.strokeWidth) * DOT_WEIGHT,
                  'vector-effect': 'non-scaling-stroke',
                })
              : // The line width is in screen pixels, not grid units.
                h(tag, { ...attrs, 'vector-effect': 'non-scaling-stroke' }),
          ),
        )
    },
  })
}

export type IconComponent = ReturnType<typeof createIcon>
