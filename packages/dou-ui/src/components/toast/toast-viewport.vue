<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale, useZIndex } from '../config-provider/use-config'
import { nextViewportId, removeToast, toastState } from './store'
import ToastStack from './toast-stack.vue'
import type { ToastPlacement, ToastViewportProps } from './toast'

defineOptions({ name: 'DouToastViewport', inheritAttrs: false })

const props = withDefaults(defineProps<ToastViewportProps>(), { max: 5, stacked: true })

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

// A placement stays on screen until its last toast has finished leaving.
const shown = reactive(new Set<ToastPlacement>())
watch(
  () => toastState.items.map((item) => item.placement),
  (used) => used.forEach((placement) => shown.add(placement)),
  { immediate: true },
)
function settle(placement: ToastPlacement) {
  if (!toastState.items.some((item) => item.placement === placement)) shown.delete(placement)
}

const groups = computed(() =>
  active.value
    ? placements
        .filter((placement) => shown.has(placement))
        .map((placement) => ({
          placement,
          items: toastState.items.filter((item) => item.placement === placement),
        }))
    : [],
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

// Toasts only ever come from the browser; rendering the viewport after
// mount keeps server-rendered pages from expecting it on hydration.
const mounted = ref(false)
onMounted(() => (mounted.value = true))
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <section
      v-for="group in groups"
      :key="group.placement"
      v-bind="$attrs"
      :class="[ns.b(), ns.m(group.placement)]"
      :style="{ zIndex }"
      :aria-label="t('toast.region')"
    >
      <ToastStack :items="group.items" :stacked="stacked" @settled="settle(group.placement)" />
    </section>
  </Teleport>
</template>
