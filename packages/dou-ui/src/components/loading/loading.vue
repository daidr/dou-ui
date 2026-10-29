<script setup lang="ts">
import { getCurrentInstance, ref, watch } from 'vue'
import { useScrollLock } from '../../composables/use-scroll-lock'
import { useThemeScope } from '../../composables/use-theme-scope'
import { useNamespace } from '../../utils/namespace'
import { useZIndex } from '../config-provider/use-config'
import LoadingMask from './loading-mask.vue'
import type { LoadingProps, LoadingSlots } from './loading'
import { useDelayed } from './use-delayed'

defineOptions({ name: 'DouLoading', inheritAttrs: false })

const props = withDefaults(defineProps<LoadingProps>(), {
  loading: false,
  fullscreen: false,
  delay: 0,
})
const slots = defineSlots<LoadingSlots>()

const ns = useNamespace('loading')
const active = useDelayed(
  () => props.loading,
  () => props.delay,
)

// A full-window mask leaves the subtree, so it takes a layer of its own
// and the theme in effect where it is declared.
const zIndex = ref<number>()
const { next } = useZIndex()
const instance = getCurrentInstance()
const { theme, sync } = useThemeScope(() => instance?.vnode.el as Node | null)
watch(
  () => props.fullscreen && active.value,
  (on) => {
    if (!on) return
    zIndex.value = next()
    sync()
  },
  { immediate: true },
)
useScrollLock(() => props.fullscreen && active.value)
</script>

<template>
  <div
    v-if="slots.default"
    :class="[ns.b(), ns.is('loading', active)]"
    :aria-busy="active || undefined"
    v-bind="$attrs"
  >
    <slot />
    <Transition v-if="!fullscreen" name="dou-loading">
      <LoadingMask v-if="active" :text="text" :size="size" />
    </Transition>
  </div>
  <Teleport v-if="fullscreen" to="body">
    <Transition name="dou-loading">
      <LoadingMask
        v-if="active"
        :text="text"
        :size="size"
        fullscreen
        :z-index="zIndex"
        :theme="theme"
      />
    </Transition>
  </Teleport>
</template>
