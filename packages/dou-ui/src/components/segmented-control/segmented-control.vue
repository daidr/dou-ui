<script setup lang="ts">
import {
  Comment,
  Fragment,
  Text,
  computed,
  createTextVNode,
  h,
  isVNode,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import type { VNode } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { SlotNodes } from '../../utils/slot'
import { useFormDisabled, useFormItem, useFormReadonly, useFormSize } from '../form/use-form-item'
import type {
  SegmentedControlOption,
  SegmentedControlProps,
  SegmentedControlSlots,
  SegmentedControlValue,
} from './segmented-control'

defineOptions({ name: 'DouSegmentedControl' })

const props = withDefaults(defineProps<SegmentedControlProps>(), {
  disabled: false,
  block: false,
})
// An explicit default stops Vue from reading a missing value as `false`.
const model = defineModel<SegmentedControlValue | undefined>({ default: undefined })
const emit = defineEmits<{ change: [value: SegmentedControlValue] }>()
const slots = defineSlots<SegmentedControlSlots>()

const ns = useNamespace('segmented-control')

// Each option is a native radio, so the browser handles arrow keys and
// keeps a single option checked, the same as a radio group.
const id = useId()
const name = computed(() => props.name ?? `dou-segmented-${id}`)

const { formItem } = useFormItem()
formItem?.markGroup()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const readonly = useFormReadonly(() => props.readonly)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)

// A read-only control takes focus but cancels the click or arrow key that would pick.
function onClick(event: MouseEvent) {
  if (readonly.value) event.preventDefault()
}
function onKeydown(event: KeyboardEvent) {
  if (readonly.value && event.key.startsWith('Arrow')) event.preventDefault()
}

const options = computed<SegmentedControlOption[]>(() =>
  props.options.map((option) =>
    typeof option === 'object' ? option : { value: option, label: String(option) },
  ),
)

function select(option: SegmentedControlOption) {
  if (disabled.value || readonly.value || option.disabled || option.value === model.value) return
  model.value = option.value
  emit('change', option.value)
  formItem?.trigger('change')
}

// The selection is a raised block that slides between the options. Its
// box is measured from the selected option, unrounded, so it covers the
// option exactly even when `block` shares out fractional widths. Layout
// sizes are used instead of screen boxes, so a scaled or rotated ancestor
// does not shift it.
const rootRef = useTemplateRef<HTMLElement>('root')

function layoutWidth(element: HTMLElement) {
  const style = getComputedStyle(element)
  const width = Number.parseFloat(style.width)
  if (Number.isNaN(width)) return element.offsetWidth
  if (style.boxSizing === 'border-box') return width
  return (
    width +
    Number.parseFloat(style.paddingLeft) +
    Number.parseFloat(style.paddingRight) +
    Number.parseFloat(style.borderLeftWidth) +
    Number.parseFloat(style.borderRightWidth)
  )
}
const indicator = ref<{ left: number; width: number } | null>(null)
// No slide for the first placement, only for later changes.
const settled = ref(false)

function measure() {
  const root = rootRef.value
  const index = options.value.findIndex((option) => option.value === model.value)
  const items = root ? [...root.querySelectorAll<HTMLElement>(`.${ns.e('item')}`)] : []
  const item = index < 0 ? undefined : items[index]
  if (!root || !item) {
    indicator.value = null
    return
  }
  // The options sit side by side from the padding edge.
  let left = Number.parseFloat(getComputedStyle(root).paddingLeft) || 0
  for (const before of items.slice(0, index)) left += layoutWidth(before)
  indicator.value = { left, width: layoutWidth(item) }
}

function flattenSlotNodes(nodes: unknown, out: VNode[] = []): VNode[] {
  for (const node of Array.isArray(nodes) ? nodes : [nodes]) {
    if (!isVNode(node)) {
      if (typeof node === 'string' || typeof node === 'number') {
        out.push(createTextVNode(String(node)))
      }
      continue
    }
    if (node.type === Fragment && Array.isArray(node.children)) {
      flattenSlotNodes(node.children, out)
      continue
    }
    out.push(node)
  }
  return out
}

function isTextOrComment(node: VNode) {
  return node.type === Text || node.type === Comment
}

function hasNonBlankText(node: VNode) {
  return node.type === Text && String(node.children ?? '').trim() !== ''
}

// Render `#option` during this component's own render so dynamic slot swaps always update.
// Returns `undefined` when the slot is absent or renders nothing (e.g. `v-if="false"`),
// falling back to the default option label; wraps bare text beside elements in a block-level
// span so ellipsis truncation still works inside the flex label.
function renderOption(option: SegmentedControlOption, checked: boolean): unknown[] | undefined {
  if (!slots.option) return undefined
  const rendered = slots.option({ option, checked })
  const nodes = flattenSlotNodes(rendered)
  const hasElement = nodes.some((node) => !isTextOrComment(node))
  const hasText = nodes.some(hasNonBlankText)
  if (!hasElement && !hasText) return undefined
  if (!hasElement) return nodes
  if (!hasText) return Array.isArray(rendered) ? rendered : [rendered]

  const result: VNode[] = []
  let textRun: VNode[] = []
  const flush = () => {
    if (!textRun.length) return
    if (textRun.some(hasNonBlankText)) {
      result.push(h('span', { class: ns.e('text') }, textRun))
    } else {
      result.push(...textRun)
    }
    textRun = []
  }

  for (const node of nodes) {
    if (isTextOrComment(node)) {
      textRun.push(node)
    } else {
      flush()
      result.push(node)
    }
  }
  flush()
  return result
}

let observer: ResizeObserver | undefined

function observeItems() {
  if (!observer || !rootRef.value) return
  observer.disconnect()
  observer.observe(rootRef.value)
  for (const item of rootRef.value.querySelectorAll<HTMLElement>(`.${ns.e('item')}`)) {
    observer.observe(item)
  }
}

onMounted(() => {
  // Measured in the next frame, before it is painted: controls mounting
  // together then share one layout, instead of each forcing one in the
  // middle of mounting, which is slow on a page with many controls.
  requestAnimationFrame(() => {
    measure()
    requestAnimationFrame(() => (settled.value = true))
  })
  if (typeof ResizeObserver !== 'undefined' && rootRef.value) {
    observer = new ResizeObserver(() => measure())
    observeItems()
  }
})
onBeforeUnmount(() => observer?.disconnect())

watch(
  options,
  () =>
    nextTick(() => {
      observeItems()
      measure()
    }),
  { deep: true },
)
watch([model, size, () => props.block], () => nextTick(measure))

const indicatorStyle = computed(() =>
  indicator.value
    ? { transform: `translateX(${indicator.value.left}px)`, width: `${indicator.value.width}px` }
    : { display: 'none' },
)

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('block', props.block),
  ns.is('disabled', disabled.value),
  ns.is('readonly', readonly.value),
  ns.is('invalid', invalid.value),
  ns.is('settled', settled.value),
])
</script>

<template>
  <div
    ref="root"
    :id="formItem?.inputId"
    :class="classes"
    role="radiogroup"
    :aria-disabled="disabled || undefined"
    :aria-labelledby="formItem?.labelId"
    :aria-describedby="formItem?.describedBy.value"
    :aria-invalid="invalid || undefined"
    :aria-readonly="readonly || undefined"
    :aria-required="formItem?.required.value || undefined"
  >
    <span :class="ns.e('indicator')" :style="indicatorStyle" aria-hidden="true" />
    <label
      v-for="option in options"
      :key="String(option.value)"
      :class="[
        ns.e('item'),
        ns.is('checked', option.value === model),
        ns.is('disabled', disabled || !!option.disabled),
      ]"
    >
      <input
        type="radio"
        :class="ns.e('native')"
        :name="name"
        :value="option.value"
        :checked="option.value === model"
        :disabled="disabled || option.disabled"
        @click="onClick"
        @keydown="onKeydown"
        @change="select(option)"
      />
      <span :class="ns.e('label')">
        <template v-for="custom in [renderOption(option, option.value === model)]" :key="0">
          <SlotNodes v-if="custom" :nodes="custom" />
          <template v-else>{{ option.label ?? String(option.value) }}</template>
        </template>
      </span>
    </label>
  </div>
</template>
