import { defineComponent, h } from 'vue'
import type { PropType } from 'vue'
import type { IconNode } from './types'

const pascal = (name: string) =>
  name.replace(/(^|-)([a-z0-9])/g, (_, __: string, char: string) => char.toUpperCase())

/**
 * The line width follows the icon's size, but more slowly than the drawing
 * does: 1.25px at 16px, 1.5px at 24px, 2.25px at 48px. Scaled with the
 * drawing, small icons clog and large ones turn heavy; kept fixed, small
 * icons look heavy and large ones faint. The icon is `1em` wide, so `em`
 * here is the icon's size.
 */
const OPTICAL_STROKE = 'calc(0.75px + 0.03125em)'

const px = (value: number | string) => (typeof value === 'number' ? `${value}px` : value)

/** Dots are a touch heavier than lines so they read as dots, not specks. */
const DOT_STROKE = 'calc(var(--dou-icons-stroke) * 1.5)'

/**
 * Turn drawn shapes on the 24 × 24 grid into a Vue component. Every icon in
 * the set is made with this, and so can your own.
 */
export function createIcon(name: string, node: IconNode) {
  return defineComponent({
    name: `${pascal(name)}Icon`,
    props: {
      size: { type: [Number, String] as PropType<number | string>, default: '1em' },
      strokeWidth: [Number, String] as PropType<number | string>,
      label: String,
    },
    setup(props) {
      return () =>
        h(
          'svg',
          {
            xmlns: 'http://www.w3.org/2000/svg',
            // Sized through the font size, so `em` in the line width is the icon's size.
            width: '1em',
            height: '1em',
            style: {
              fontSize: props.size === '1em' ? undefined : px(props.size),
              '--dou-icons-stroke':
                props.strokeWidth === undefined ? OPTICAL_STROKE : px(props.strokeWidth),
              strokeWidth: 'var(--dou-icons-stroke)',
            },
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': 1.5,
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
                  style: { strokeWidth: DOT_STROKE },
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
