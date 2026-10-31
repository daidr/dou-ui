<script setup lang="ts">
import { CheckIcon } from '@dou-ui/icons'
import { computed, nextTick, shallowRef, useId, watch } from 'vue'
import { optionOf, type SheetCellPanelProps } from '../core/cell-type'
import { formatValue, inputText } from '../core/format'
import type { SheetValue } from '../core/model'
import { useSheet } from '../context'

const props = defineProps<SheetCellPanelProps>()
const emit = defineEmits<{ pick: [value: SheetValue] }>()
const { messages } = useSheet()
const id = `dou-sheet-options-${useId()}`

const all = computed(() =>
  (props.setup.options ?? []).map((option) => {
    const { value, tone } = optionOf(option)
    return { value, tone, label: formatValue(value) }
  }),
)
/** The options that start with (or contain) what was typed; all of them until something is. */
const options = computed(() => {
  const query = props.typed ? props.text.trim().toLowerCase() : ''
  if (!query) return all.value
  const starts = all.value.filter((o) => o.label.toLowerCase().startsWith(query))
  const contains = all.value.filter(
    (o) => !starts.includes(o) && o.label.toLowerCase().includes(query),
  )
  return [...starts, ...contains]
})

const active = shallowRef(-1)
watch(
  options,
  (list) => {
    const current = list.findIndex((o) => o.value === props.value)
    active.value = props.typed ? (list.length ? 0 : -1) : current
  },
  { immediate: true },
)
watch(active, (index) => {
  void nextTick(() =>
    document.getElementById(`${id}-${index}`)?.scrollIntoView({ block: 'nearest' }),
  )
})

function onKey(event: KeyboardEvent) {
  const count = options.value.length
  if (!count || event.altKey || event.ctrlKey || event.metaKey) return false
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      const step = event.key === 'ArrowDown' ? 1 : -1
      active.value =
        active.value < 0 ? (step > 0 ? 0 : count - 1) : (active.value + step + count) % count
      return true
    }
    case 'Enter':
    case 'Tab': {
      const option = options.value[active.value]
      // with nothing picked, Enter writes what was typed
      if (!option || (!props.typed && option.value === props.value)) return false
      emit('pick', option.value)
      return true
    }
    default:
      return false
  }
}

defineExpose({
  onKey,
  activeId: computed(() => (active.value >= 0 ? `${id}-${active.value}` : null)),
})
</script>

<template>
  <div :id="id" class="dou-sheet__options" role="listbox" :aria-label="messages.options">
    <div
      v-for="(option, index) in options"
      :id="`${id}-${index}`"
      :key="inputText(option.value)"
      role="option"
      class="dou-dropdown__item dou-sheet__option"
      :class="{ 'is-active': index === active }"
      :aria-selected="option.value === value"
      @pointermove="active = index"
      @click="emit('pick', option.value)"
    >
      <span
        class="dou-tag dou-tag--soft dou-sheet__tag"
        :class="option.tone && option.tone !== 'neutral' && `dou-tag--${option.tone}`"
        >{{ option.label }}</span
      >
      <CheckIcon v-if="option.value === value" class="dou-sheet__option-check" />
    </div>
    <div v-if="!options.length" class="dou-sheet__options-empty">{{ messages.noOptions }}</div>
  </div>
</template>
