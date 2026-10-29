<script setup lang="ts">
import { ArrowUpIcon } from '@dou-ui/icons'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useReducedMotion } from '../../composables/use-motion'
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
const reducedMotion = useReducedMotion()
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
  target?.scrollTo({ top: 0, behavior: reducedMotion.value ? 'auto' : 'smooth' })
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
        <ArrowUpIcon />
      </slot>
    </button>
  </Transition>
</template>
