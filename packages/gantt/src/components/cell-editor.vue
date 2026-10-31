<script setup lang="ts">
import { DouInputDate } from 'dou-ui'
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

/*
 * The editor inside a table cell. It keeps its own value and hands it
 * back once: on Enter, on a pick from the calendar, or on a press outside.
 * Escape hands back nothing.
 */

const props = defineProps<{
  kind: 'text' | 'number' | 'date' | 'datetime'
  value: string
  label: string
  placeholder?: string
  /** Keep editing after Enter, with the field emptied: for adding tasks one after another. */
  repeat?: boolean
}>()
const emit = defineEmits<{
  /** `null` when cancelled. */
  done: [value: string | null]
  /** Tab or Shift+Tab in a text field. */
  tab: [back: boolean]
}>()

const draft = ref(props.value)
const root = useTemplateRef<HTMLElement>('root')
let finished = false

function finish(value: string | null) {
  if (finished) return
  if (props.repeat && value != null) {
    emit('done', value)
    draft.value = ''
    return
  }
  finished = true
  emit('done', value)
}

function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Enter') finish(String(draft.value))
  else if (event.key === 'Escape') finish(null)
  else if (event.key === 'Tab' && props.kind === 'text') emit('tab', event.shiftKey)
  else return
  event.preventDefault()
  // keep the chart from reading the key as its own
  event.stopPropagation()
}

// a press outside the cell ends editing; the calendar is in its own layer
function onOutside(event: PointerEvent) {
  const target = event.target as Element | null
  if (!target || root.value?.contains(target) || target.closest('.dou-floating')) return
  finish(String(draft.value))
}

function onPick(value: unknown) {
  if (typeof value !== 'string') return
  draft.value = value
}

onMounted(() => {
  document.addEventListener('pointerdown', onOutside, true)
  void nextTick(() => {
    const input = root.value?.querySelector<HTMLElement>(
      'input, [tabindex="0"], [role="spinbutton"]',
    )
    input?.focus()
    if (input instanceof HTMLInputElement) input.select()
  })
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside, true))
</script>

<template>
  <div
    ref="root"
    class="dou-gantt__editor"
    :class="`is-${kind}`"
    @keydown="onKeydown"
    @pointerdown.stop
    @dblclick.stop
    @click.stop
  >
    <DouInputDate
      v-if="kind === 'date' || kind === 'datetime'"
      :model-value="draft || null"
      :type="kind"
      size="sm"
      picker
      :aria-label="label"
      @update:model-value="onPick"
      @change="onPick"
    />
    <input
      v-else
      v-model="draft"
      class="dou-gantt__editor-input"
      :type="kind === 'number' ? 'number' : 'text'"
      :inputmode="kind === 'number' ? 'decimal' : undefined"
      :aria-label="label"
      :placeholder="placeholder"
    />
  </div>
</template>
