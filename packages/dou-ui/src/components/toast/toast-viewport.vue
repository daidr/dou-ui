<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale, useZIndex } from '../config-provider/use-config'
import { nextViewportId, removeToast, toastState } from './store'
import ToastItem from './toast-item.vue'
import type { ToastPlacement, ToastViewportProps } from './toast'

defineOptions({ name: 'DouToastViewport', inheritAttrs: false })

const props = withDefaults(defineProps<ToastViewportProps>(), { max: 5 })

const ns = useNamespace('toast')
const { t } = useLocale()
const { next } = useZIndex()

// Only the latest viewport shows the toasts, so one placed inside a
// provider takes over from the one `toast()` mounted on its own.
const self = nextViewportId()
toastState.viewports.push(self)
onBeforeUnmount(() => toastState.viewports.splice(toastState.viewports.indexOf(self), 1))
const active = computed(() => toastState.viewports.at(-1) === self)

const placements: ToastPlacement[] = [
  'top',
  'top-left',
  'top-right',
  'bottom',
  'bottom-left',
  'bottom-right',
]

const groups = computed(() =>
  placements
    .map((placement) => ({
      placement,
      items: active.value ? toastState.items.filter((item) => item.placement === placement) : [],
    }))
    .filter((group) => group.items.length > 0),
)

// Too many at one placement: the oldest go first.
watch(
  () => toastState.items.length,
  () => {
    for (const placement of placements) {
      const items = toastState.items.filter((item) => item.placement === placement)
      for (const item of items.slice(0, Math.max(0, items.length - props.max))) {
        removeToast(item.id)
      }
    }
  },
)

// A new toast rises above every layer opened before it.
const zIndex = ref<number>()
watch(
  () => toastState.items.length,
  (length, previous = 0) => {
    if (length > previous) zIndex.value = next()
  },
  { immediate: true },
)
</script>

<template>
  <Teleport to="body">
    <section
      v-for="group in groups"
      :key="group.placement"
      v-bind="$attrs"
      :class="[ns.b(), ns.m(group.placement)]"
      :style="{ zIndex }"
      :aria-label="t('toast.region')"
    >
      <TransitionGroup tag="ol" :class="ns.e('list')" name="dou-toast">
        <ToastItem v-for="item in group.items" :key="item.id" :toast="item" />
      </TransitionGroup>
    </section>
  </Teleport>
</template>
