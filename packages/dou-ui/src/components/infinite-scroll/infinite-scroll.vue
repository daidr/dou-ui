<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { DouSpinner } from '../spinner'
import type {
  InfiniteScrollExpose,
  InfiniteScrollProps,
  InfiniteScrollSlots,
} from './infinite-scroll'
import { watchScrollEnd } from './scroll-end'

defineOptions({ name: 'DouInfiniteScroll' })

const props = withDefaults(defineProps<InfiniteScrollProps>(), {
  finished: false,
  disabled: false,
  distance: 100,
  immediate: true,
})
defineSlots<InfiniteScrollSlots>()

const ns = useNamespace('infinite-scroll')
const { t } = useLocale()
const rootRef = useTemplateRef<HTMLElement>('root')

const loading = ref(false)
const failed = ref(false)
const error = ref<unknown>()

async function load() {
  loading.value = true
  try {
    await props.load()
  } catch (reason) {
    failed.value = true
    error.value = reason
  } finally {
    loading.value = false
  }
}

let watcher: ReturnType<typeof watchScrollEnd> | undefined
function start() {
  watcher?.stop()
  watcher = watchScrollEnd({
    el: rootRef.value!,
    target: props.target,
    distance: () => props.distance,
    active: () => !props.finished && !props.disabled && !failed.value,
    load,
  })
}
const check = () => void watcher?.check()

onMounted(() => {
  start()
  if (props.immediate) check()
})
onBeforeUnmount(() => watcher?.stop())
watch(
  () => props.target,
  () => {
    start()
    check()
  },
)
// Turning loading back on picks up where the list ends now.
watch(
  () => [props.finished, props.disabled],
  ([finished, disabled]) => {
    if (!finished && !disabled) check()
  },
)

function retry() {
  failed.value = false
  error.value = undefined
  check()
}

defineExpose<InfiniteScrollExpose>({ check, retry })
</script>

<template>
  <div ref="root" :class="ns.b()" :aria-busy="loading || undefined">
    <slot />
    <div :class="ns.e('footer')" role="status">
      <template v-if="loading">
        <slot name="loading">
          <DouSpinner size="sm" aria-hidden="true" />
          {{ t('infiniteScroll.loading') }}
        </slot>
      </template>
      <template v-else-if="failed">
        <slot name="error" :error="error" :retry="retry">
          {{ t('infiniteScroll.error') }}
          <button type="button" :class="ns.e('retry')" @click="retry">
            {{ t('infiniteScroll.retry') }}
          </button>
        </slot>
      </template>
      <template v-else-if="finished">
        <slot name="finished">{{ t('infiniteScroll.finished') }}</slot>
      </template>
    </div>
  </div>
</template>
