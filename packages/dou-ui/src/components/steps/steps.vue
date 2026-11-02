<script setup lang="ts">
import { CheckIcon, CloseIcon } from '@dou-ui/icons'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DouTooltip from '../tooltip/tooltip.vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type { StepItem, StepStatus, StepsProps, StepsSlots } from './steps'

defineOptions({ name: 'DouSteps' })

const props = withDefaults(defineProps<StepsProps>(), {
  items: () => [],
  status: 'process',
  direction: 'horizontal',
  size: 'md',
  clickable: false,
})
const current = defineModel<number>('current', { default: 0 })
const emit = defineEmits<{ change: [current: number] }>()
defineSlots<StepsSlots>()

const ns = useNamespace('steps')
const { t } = useLocale()

function statusOf(item: StepItem, index: number): StepStatus {
  if (item.status) return item.status
  if (index < current.value) return 'finish'
  if (index === current.value) return props.status
  return 'wait'
}

/*
 * A horizontal row that does not fit its line keeps only the current
 * step's title; the others are read out and shown on hover. If even the
 * markers do not fit, the row scrolls, with the current step in view.
 */
const root = ref<HTMLOListElement>()
const compact = ref(false)
/** The width the row needs with every title, measured when it last overflowed. */
let fullWidth = 0
let observer: ResizeObserver | undefined

function measure() {
  const el = root.value
  if (!el) return
  if (props.direction !== 'horizontal') {
    compact.value = false
    return
  }
  if (!compact.value) {
    if (el.scrollWidth > el.clientWidth + 1) {
      fullWidth = el.scrollWidth
      compact.value = true
      void nextTick(reveal)
    }
  } else if (innerWidth(el) >= fullWidth) {
    compact.value = false
  } else {
    reveal()
  }
}

/** The width inside the padding that only the compact row has. */
function innerWidth(el: HTMLElement) {
  const style = getComputedStyle(el)
  return (
    el.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
  )
}

/** Scrolls the row, never the page, so the current step shows. */
function reveal() {
  const el = root.value
  const item = el?.children[current.value] as HTMLElement | undefined
  if (!el || !item || el.scrollWidth <= el.clientWidth) return
  const box = el.getBoundingClientRect()
  const rect = item.getBoundingClientRect()
  if (rect.left < box.left) el.scrollLeft -= box.left - rect.left
  else if (rect.right > box.right) el.scrollLeft += rect.right - box.right
}

/** Measures again with every title shown, after the steps change. */
function remeasure() {
  compact.value = false
  void nextTick(measure)
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    observer = new ResizeObserver(() => measure())
    observer.observe(root.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())
watch(
  () => [
    props.direction,
    props.size,
    props.items.map((item) => item.title + (item.description ?? '')),
  ],
  remeasure,
  { deep: true },
)
watch(current, () => void nextTick(measure))

function go(item: StepItem, index: number) {
  if (!props.clickable || item.disabled || index === current.value) return
  current.value = index
  emit('change', index)
}
</script>

<template>
  <ol
    ref="root"
    :class="[
      ns.b(),
      ns.m(direction),
      ns.m(size),
      ns.is('clickable', clickable),
      ns.is('compact', compact),
    ]"
  >
    <li
      v-for="(item, index) in items"
      :key="index"
      :class="[ns.e('item'), ns.is(statusOf(item, index)), ns.is('disabled', !!item.disabled)]"
      :aria-current="index === current ? 'step' : undefined"
    >
      <DouTooltip :content="item.title" :disabled="!compact || index === current">
        <component
          :is="clickable ? 'button' : 'div'"
          :type="clickable ? 'button' : undefined"
          :disabled="clickable && item.disabled ? true : undefined"
          :class="ns.e('main')"
          @click="go(item, index)"
        >
          <span :class="ns.e('marker')" aria-hidden="true">
            <component :is="item.icon" v-if="item.icon" :class="ns.e('icon')" />
            <CheckIcon v-else-if="statusOf(item, index) === 'finish'" :stroke-width="1.75" />
            <CloseIcon v-else-if="statusOf(item, index) === 'error'" :stroke-width="1.75" />
            <span v-else :class="ns.e('number')">{{ index + 1 }}</span>
          </span>
          <span :class="ns.e('text')">
            <span :class="ns.e('title')">
              <slot name="title" :item="item" :index="index" :status="statusOf(item, index)">
                {{ item.title }}
              </slot>
              <span :class="ns.e('status')">{{ ' ' + t(`steps.${statusOf(item, index)}`) }}</span>
            </span>
            <span v-if="item.description || $slots.description" :class="ns.e('description')">
              <slot name="description" :item="item" :index="index" :status="statusOf(item, index)">
                {{ item.description }}
              </slot>
            </span>
          </span>
        </component>
      </DouTooltip>
      <span v-if="index < items.length - 1" :class="ns.e('line')" aria-hidden="true" />
    </li>
  </ol>
</template>
