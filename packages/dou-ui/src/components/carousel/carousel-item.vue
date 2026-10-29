<script setup lang="ts">
import { computed, getCurrentInstance, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import type { CSSProperties } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { carouselKey } from './carousel'
import type { CarouselItemProps, CarouselItemSlots } from './carousel'

defineOptions({ name: 'DouCarouselItem' })

const props = defineProps<CarouselItemProps>()
defineSlots<CarouselItemSlots>()

const ns = useNamespace('carousel')
const { t } = useLocale()
const carousel = inject(carouselKey, undefined)
const uid = getCurrentInstance()!.uid
const el = ref<HTMLElement | null>(null)

carousel?.register({ uid, el })
onMounted(() => carousel?.reorder())
onBeforeUnmount(() => carousel?.unregister(uid))

const place = computed(() => carousel?.place(uid) ?? { index: 0, offset: 0, animate: false })
const active = computed(() => place.value.offset === 0)
const label = computed(
  () =>
    props.label ??
    t('carousel.slide', { index: place.value.index + 1, total: carousel?.total.value ?? 1 }),
)

const style = computed<CSSProperties>(() => {
  if (!carousel || carousel.effect.value === 'fade') return {}
  const axis = carousel.direction.value === 'vertical' ? 'Y' : 'X'
  const drag = carousel.drag.value
  return {
    transform: `translate${axis}(calc(${place.value.offset * 100}% + ${drag}px))`,
    transitionDuration: place.value.animate && !drag ? undefined : '0s',
  }
})
</script>

<template>
  <div
    ref="el"
    role="group"
    aria-roledescription="slide"
    :aria-label="label"
    :aria-hidden="active ? undefined : 'true'"
    :inert="!active"
    :class="[ns.e('item'), ns.is('active', active)]"
    :style="style"
  >
    <slot :active="active" :index="place.index" />
  </div>
</template>
