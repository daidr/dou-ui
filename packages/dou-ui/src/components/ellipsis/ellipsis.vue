<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUpdated, ref, useTemplateRef, watch } from 'vue'
import { useResizeObserver } from '../../composables/use-element-size'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { DouTooltip } from '../tooltip'
import type { FunctionalComponent } from 'vue'
import type { EllipsisExpose, EllipsisProps, EllipsisSlots } from './ellipsis'

defineOptions({ name: 'DouEllipsis', inheritAttrs: false })

const props = withDefaults(defineProps<EllipsisProps>(), {
  lines: 1,
  expandable: false,
  expanded: undefined,
  tooltip: false,
  tooltipPlacement: 'top',
  as: 'div',
})
const emit = defineEmits<{ 'update:expanded': [expanded: boolean] }>()
const slots = defineSlots<EllipsisSlots>()

// Without `tooltip`, skip the tooltip's popup machinery altogether.
const Passthrough: FunctionalComponent = (_, context) => context.slots.default?.()
Passthrough.inheritAttrs = false

const ns = useNamespace('ellipsis')
const { t } = useLocale()
const textRef = useTemplateRef<HTMLElement>('text')

const innerExpanded = ref(false)
const expanded = computed(() => props.expandable && (props.expanded ?? innerExpanded.value))
function toggle() {
  const next = !expanded.value
  innerExpanded.value = next
  emit('update:expanded', next)
}

const truncated = ref(false)
function lineHeight(el: HTMLElement) {
  const style = getComputedStyle(el)
  const value = parseFloat(style.lineHeight)
  return Number.isFinite(value) ? value : parseFloat(style.fontSize) * 1.2
}
function measure() {
  const el = textRef.value
  if (!el) return
  // Collapsed, the clamped box is shorter than its content; expanded,
  // the text is taller than the lines it would be cut to.
  truncated.value = expanded.value
    ? el.clientHeight > props.lines * lineHeight(el) + 1
    : el.scrollHeight > el.clientHeight + 1
}

onMounted(measure)
useResizeObserver(textRef, () => measure())
onUpdated(measure)
watch(() => props.lines, measure, { flush: 'post' })

const showToggle = computed(() => props.expandable && (truncated.value || expanded.value))
const showTooltip = computed(() => props.tooltip && !props.expandable && truncated.value)

defineExpose<EllipsisExpose>({
  get truncated() {
    return truncated.value
  },
})
</script>

<template>
  <component
    :is="tooltip ? DouTooltip : Passthrough"
    :disabled="!showTooltip"
    :placement="tooltipPlacement"
  >
    <component
      :is="as"
      v-bind="$attrs"
      :class="[
        ns.b(),
        ns.is('expanded', expanded),
        ns.is('truncated', truncated),
        ns.is('expandable', expandable),
      ]"
      :style="{ '--dou-ellipsis-lines': lines }"
    >
      <span ref="text" :class="ns.e('text')">
        <button
          v-if="showToggle"
          type="button"
          :class="ns.e('toggle')"
          :aria-expanded="expanded"
          @click="toggle"
        >
          <slot name="toggle" :expanded="expanded">
            {{ expanded ? t('ellipsis.collapse') : t('ellipsis.expand') }}
          </slot>
        </button>
        <slot />
      </span>
    </component>
    <template #content>
      <slot name="tooltip"><slot /></slot>
    </template>
  </component>
</template>
