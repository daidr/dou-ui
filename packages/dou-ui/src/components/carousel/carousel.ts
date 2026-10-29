import type { InjectionKey, Ref } from 'vue'

export type CarouselDirection = 'horizontal' | 'vertical'
export type CarouselEffect = 'slide' | 'fade'
export type CarouselIndicators = 'inside' | 'outside' | 'none'
export type CarouselArrows = 'hover' | 'always' | 'never'

export interface CarouselProps {
  /** The index of the slide shown, bound with `v-model`. Defaults to `0`. */
  modelValue?: number
  direction?: CarouselDirection
  /** `slide` moves slides along; `fade` crossfades them in place. */
  effect?: CarouselEffect
  /** Go from the last slide on to the first, and back. */
  loop?: boolean
  /** Move on by itself every `interval` ms. Pauses on hover and focus, and with reduced motion. */
  autoplay?: boolean
  interval?: number
  /** Where the dots go. */
  indicators?: CarouselIndicators
  /** When the previous / next buttons show. */
  arrows?: CarouselArrows
  /** Swipe or drag with the pointer to change slides. */
  draggable?: boolean
  /** A fixed height, e.g. `'240px'`. Defaults to the height of the slide shown. */
  height?: string
  /** Names the carousel for screen readers. */
  label?: string
}

export interface CarouselEmits {
  'update:modelValue': [index: number]
  /** The slide shown changed. */
  change: [index: number, previous: number]
}

export interface CarouselSlots {
  /** The slides, `DouCarouselItem`s. */
  default?: () => unknown
}

export interface CarouselExpose {
  /** Show the slide at `index`. */
  goTo: (index: number) => void
  next: () => void
  prev: () => void
}

export interface CarouselItemProps {
  /** Names the slide for screen readers. Defaults to "n / total". */
  label?: string
}

export interface CarouselItemSlots {
  default?: (props: { active: boolean; index: number }) => unknown
}

export interface CarouselItemEntry {
  uid: number
  el: Ref<HTMLElement | null>
}

export interface CarouselContext {
  register: (entry: CarouselItemEntry) => void
  unregister: (uid: number) => void
  reorder: () => void
  /** The index of an item, its offset from the slide shown, and whether it should animate. */
  place: (uid: number) => { index: number; offset: number; animate: boolean }
  total: Readonly<Ref<number>>
  current: Readonly<Ref<number>>
  direction: Readonly<Ref<CarouselDirection>>
  effect: Readonly<Ref<CarouselEffect>>
  /** Pixels the pointer has dragged the slides by. */
  drag: Readonly<Ref<number>>
}

export const carouselKey: InjectionKey<CarouselContext> = Symbol('DouCarousel')
