<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { MarqueeProps, MarqueeSlots } from './marquee'

defineOptions({ name: 'DouMarquee' })

const props = withDefaults(defineProps<MarqueeProps>(), {
  direction: 'horizontal',
  speed: 40,
  reverse: false,
  gap: 32,
  pauseOnHover: true,
  paused: false,
  fade: true,
})
defineSlots<MarqueeSlots>()

const ns = useNamespace('marquee')

const rootRef = useTemplateRef<HTMLElement>('root')
const contentRef = useTemplateRef<HTMLElement>('content')

const vertical = computed(() => props.direction === 'vertical')
// The size of one copy of the content, and of the visible box.
const size = ref(0)
const box = ref(0)

function measure() {
  const content = contentRef.value
  const root = rootRef.value
  if (!content || !root) return
  size.value = vertical.value ? content.offsetHeight : content.offsetWidth
  box.value = vertical.value ? root.clientHeight : root.clientWidth
}

let observer: ResizeObserver | undefined
onMounted(() => {
  measure()
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(measure)
  if (rootRef.value) observer.observe(rootRef.value)
  if (contentRef.value) observer.observe(contentRef.value)
})
onBeforeUnmount(() => observer?.disconnect())

// One loop moves the track by a copy and a gap; enough copies follow to
// keep the box full the whole way.
const distance = computed(() => size.value + props.gap)
const copies = computed(() =>
  size.value > 0 ? Math.max(1, Math.ceil((box.value + props.gap) / distance.value)) : 0,
)
const ready = computed(() => size.value > 0)

const style = computed(() => ({
  '--dou-marquee-gap': `${props.gap}px`,
  '--dou-marquee-distance': `${distance.value}px`,
  '--dou-marquee-duration': `${distance.value / Math.max(props.speed, 1)}s`,
}))
</script>

<template>
  <div
    ref="root"
    :class="[
      ns.b(),
      ns.m(direction),
      ns.is('ready', ready),
      ns.is('reverse', reverse),
      ns.is('paused', paused),
      ns.is('pausable', pauseOnHover),
      ns.is('fade', fade),
    ]"
    :style="style"
  >
    <div :class="ns.e('track')">
      <div ref="content" :class="ns.e('content')"><slot /></div>
      <div v-for="n in copies" :key="n" :class="ns.e('content')" aria-hidden="true" inert>
        <slot />
      </div>
    </div>
  </div>
</template>
