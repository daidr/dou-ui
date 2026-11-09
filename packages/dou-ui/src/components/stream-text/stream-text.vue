<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { safeCut } from './stream-text'
import type {
  StreamTextEmits,
  StreamTextExpose,
  StreamTextProps,
  StreamTextSlots,
} from './stream-text'

defineOptions({ name: 'DouStreamText' })

const props = withDefaults(defineProps<StreamTextProps>(), {
  content: '',
  streaming: false,
  smooth: true,
  speed: 40,
  caret: true,
  as: 'div',
})
const emit = defineEmits<StreamTextEmits>()
const slots = defineSlots<StreamTextSlots>()

const ns = useNamespace('stream-text')

// How many UTF-16 units of `content` are shown. Text that is already
// complete when mounted is shown at once; a stream starts from nothing.
const shown = ref(props.streaming && props.smooth ? 0 : props.content.length)
const text = computed(() => props.content.slice(0, shown.value))
const revealing = computed(() => shown.value < props.content.length)
const done = computed(() => !props.streaming && !revealing.value)

let frame = 0
let last = 0
// fractional characters carried between frames
let carry = 0

function stop() {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
}

function tick(now: number) {
  frame = 0
  const total = props.content.length
  const elapsed = last ? Math.min(now - last, 100) : 16
  last = now
  const backlog = total - shown.value
  if (backlog <= 0) return
  // At least `speed` per second; a backlog drains in about half a second,
  // so the text never lags far behind what has arrived.
  carry += Math.max(props.speed, backlog * 2) * (elapsed / 1000)
  const step = Math.floor(carry)
  if (step > 0) {
    carry -= step
    shown.value = safeCut(props.content, Math.min(total, shown.value + step))
  }
  if (shown.value < total) frame = requestAnimationFrame(tick)
}

function start() {
  if (frame || typeof requestAnimationFrame === 'undefined') {
    if (!frame) flush()
    return
  }
  last = 0
  frame = requestAnimationFrame(tick)
}

function flush() {
  stop()
  carry = 0
  shown.value = props.content.length
}

watch(
  () => props.content,
  (value, previous) => {
    // Replaced rather than extended: keep what still matches.
    if (!value.startsWith(previous.slice(0, shown.value))) {
      let common = 0
      while (common < shown.value && value[common] === previous[common]) common++
      shown.value = safeCut(value, common)
    }
    if (!props.smooth) flush()
    else if (shown.value < value.length) start()
  },
)
watch(
  () => props.smooth,
  (smooth) => {
    if (!smooth) flush()
  },
)
watch(done, (value) => {
  if (value) emit('done')
})

onMounted(() => {
  if (revealing.value) start()
})
onBeforeUnmount(stop)

defineExpose<StreamTextExpose>({ flush })
</script>

<template>
  <component
    :is="as"
    :class="[ns.b(), ns.is('streaming', !done), ns.is('plain', !slots.default)]"
    :aria-busy="!done || undefined"
  >
    <slot :text="text" :done="done">{{ text }}</slot
    ><span v-if="caret && !done" :class="ns.e('caret')" aria-hidden="true" /><span
      v-if="slots.trailing"
      :class="ns.e('trailing')"
      ><slot name="trailing"
    /></span>
  </component>
</template>
