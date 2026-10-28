<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { resolveScrollTarget, scrollTopOf } from '../../utils/scroll'
import { useLocale } from '../config-provider/use-config'
import type { BackTopProps, BackTopSlots } from './back-top'

defineOptions({ name: 'DouBackTop' })

const props = withDefaults(defineProps<BackTopProps>(), {
  visibilityHeight: 400,
  right: 24,
  bottom: 24,
})
const emit = defineEmits<{ click: [event: MouseEvent] }>()
defineSlots<BackTopSlots>()

const ns = useNamespace('back-top')
const { t } = useLocale()

const visible = ref(false)
let target: HTMLElement | Window | undefined
const update = () => {
  if (target) visible.value = scrollTopOf(target) >= props.visibilityHeight
}

function listen() {
  target?.removeEventListener('scroll', update)
  target = props.target ? resolveScrollTarget(props.target, null) : window
  target.addEventListener('scroll', update, { passive: true })
  update()
}
onMounted(listen)
onBeforeUnmount(() => target?.removeEventListener('scroll', update))
watch(() => props.target, listen)
watch(() => props.visibilityHeight, update)

function onClick(event: MouseEvent) {
  emit('click', event)
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  target?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
}
</script>

<template>
  <Transition name="dou-back-top">
    <button
      v-show="visible"
      type="button"
      :class="ns.b()"
      :style="{ right: `${right}px`, bottom: `${bottom}px` }"
      :aria-label="t('backTop.label')"
      @click="onClick"
    >
      <slot>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M8 13V4M4 7.5L8 3.5l4 4M3.5 2h9" />
        </svg>
      </slot>
    </button>
  </Transition>
</template>
