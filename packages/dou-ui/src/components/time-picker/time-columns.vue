<script setup lang="ts">
import { computed, nextTick, onMounted, useId, watch } from 'vue'
import { useReducedMotion } from '../../composables/use-motion'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type { TimeParts } from './time'

defineOptions({ name: 'DouTimeColumns' })

const props = defineProps<{
  value: TimeParts | null
  seconds: boolean
  steps: [number, number, number]
  /** Names the group, for a range. */
  label?: string
}>()
const emit = defineEmits<{ pick: [parts: TimeParts] }>()

const ns = useNamespace('time-picker')
const reducedMotion = useReducedMotion()
const { t } = useLocale()
const id = useId()

type Unit = keyof TimeParts
const units = computed<{ unit: Unit; label: string; count: number; step: number }[]>(() => {
  const list: { unit: Unit; label: string; count: number; step: number }[] = [
    { unit: 'hour', label: t('timePicker.hour'), count: 24, step: props.steps[0] },
    { unit: 'minute', label: t('timePicker.minute'), count: 60, step: props.steps[1] },
  ]
  if (props.seconds)
    list.push({ unit: 'second', label: t('timePicker.second'), count: 60, step: props.steps[2] })
  return list
})
const valuesOf = (count: number, step: number) =>
  Array.from({ length: Math.ceil(count / step) }, (_, index) => index * step)

const current = (unit: Unit) => props.value?.[unit] ?? 0
const cellId = (unit: Unit, value: number) => `${id}-${unit}-${value}`

function pick(unit: Unit, value: number) {
  const base = props.value ?? { hour: 0, minute: 0, second: 0 }
  emit('pick', { ...base, [unit]: value })
}

const columns = new Map<Unit, HTMLElement>()
function setColumn(unit: Unit, el: unknown) {
  if (el instanceof HTMLElement) columns.set(unit, el)
}

// The chosen row sits at the top of its column.
function align(smooth = false) {
  for (const { unit } of units.value) {
    const column = columns.get(unit)
    const cell = column?.querySelector<HTMLElement>(`#${CSS.escape(cellId(unit, current(unit)))}`)
    if (column && cell)
      column.scrollTo?.({
        top: cell.offsetTop - 4,
        behavior: smooth && !reducedMotion.value ? 'smooth' : 'instant',
      })
  }
}
onMounted(align)
watch(
  () => props.value,
  () => nextTick(() => align(true)),
)

function onKeydown(event: KeyboardEvent, index: number) {
  const { unit, count, step } = units.value[index]!
  const values = valuesOf(count, step)
  const at = Math.max(0, values.indexOf(current(unit)))
  let next: number | undefined
  switch (event.key) {
    case 'ArrowDown':
      next = values[(at + 1) % values.length]
      break
    case 'ArrowUp':
      next = values[(at - 1 + values.length) % values.length]
      break
    case 'Home':
      next = values[0]
      break
    case 'End':
      next = values.at(-1)
      break
    case 'ArrowRight':
    case 'ArrowLeft': {
      const target = units.value[index + (event.key === 'ArrowRight' ? 1 : -1)]
      if (target) {
        event.preventDefault()
        columns.get(target.unit)?.focus()
      }
      return
    }
    default:
      return
  }
  event.preventDefault()
  if (next !== undefined) pick(unit, next)
}

defineExpose({ focus: () => columns.get('hour')?.focus() })
</script>

<template>
  <div :class="ns.e('columns')" role="group" :aria-label="label">
    <div v-if="label" :class="ns.e('caption')" aria-hidden="true">{{ label }}</div>
    <div :class="ns.e('grid')">
      <ul
        v-for="(column, index) in units"
        :key="column.unit"
        :ref="(el) => setColumn(column.unit, el)"
        role="listbox"
        tabindex="0"
        :aria-label="column.label"
        :aria-activedescendant="value ? cellId(column.unit, current(column.unit)) : undefined"
        :class="ns.e('column')"
        @keydown="onKeydown($event, index)"
      >
        <li
          v-for="cell in valuesOf(column.count, column.step)"
          :id="cellId(column.unit, cell)"
          :key="cell"
          role="option"
          :aria-selected="!!value && current(column.unit) === cell"
          :class="[ns.e('cell'), ns.is('selected', !!value && current(column.unit) === cell)]"
          @click="pick(column.unit, cell)"
        >
          {{ String(cell).padStart(2, '0') }}
        </li>
      </ul>
    </div>
  </div>
</template>
