<script setup lang="ts">
import {
  DouButton,
  DouDialog,
  DouForm,
  DouFormItem,
  DouInputNumber,
  DouSegmentedControl,
  DouSelect,
} from 'dou-ui'
import { computed, ref, watch } from 'vue'
import type { PivotFilter } from '../engine/types'
import type { PivotMessages } from '../locale'
import { format } from '../locale'
import type { PivotRank } from './model'

const props = defineProps<{
  messages: PivotMessages
  /** The field's name as shown. */
  field: string
  /** The values to rank by, with their headers. */
  values: string[]
  /** The field's filter as it is. */
  filter: PivotFilter | undefined
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [rank: PivotRank | null] }>()

type Mode = 'top' | 'bottom' | 'between'
const mode = ref<Mode>('top')
const count = ref<number | null>(10)
const min = ref<number | null>(null)
const max = ref<number | null>(null)
const valueIndex = ref(0)

watch(open, (now) => {
  if (!now) return
  const { top, between } = props.filter ?? {}
  mode.value = between ? 'between' : top?.order === 'asc' ? 'bottom' : 'top'
  count.value = top?.count ?? 10
  min.value = between?.min ?? null
  max.value = between?.max ?? null
  valueIndex.value = top?.valueIndex ?? between?.valueIndex ?? 0
})

const m = computed(() => props.messages.topDialog)
const modes = computed(() => [
  { value: 'top', label: m.value.top },
  { value: 'bottom', label: m.value.bottom },
  { value: 'between', label: m.value.between },
])
const valueOptions = computed(() => props.values.map((label, value) => ({ label, value })))
const ready = computed(() =>
  mode.value === 'between' ? min.value !== null || max.value !== null : (count.value ?? 0) >= 1,
)

function apply() {
  if (!ready.value) return
  const index = valueIndex.value ? { valueIndex: valueIndex.value } : {}
  if (mode.value === 'between') {
    emit('apply', {
      between: {
        ...index,
        ...(min.value === null ? {} : { min: min.value }),
        ...(max.value === null ? {} : { max: max.value }),
      },
    })
  } else {
    emit('apply', {
      top: {
        count: Math.round(count.value!),
        ...index,
        ...(mode.value === 'bottom' ? { order: 'asc' as const } : {}),
      },
    })
  }
  open.value = false
}
function clear() {
  emit('apply', null)
  open.value = false
}
</script>

<template>
  <DouDialog v-model:open="open" :title="format(m.title, { field })" :width="400">
    <DouForm layout="vertical" class="dou-pivot-top" @submit="apply">
      <DouSegmentedControl v-model="mode" :options="modes" block />
      <DouFormItem v-if="values.length > 1" :label="m.by">
        <DouSelect v-model="valueIndex" :options="valueOptions" />
      </DouFormItem>
      <DouFormItem v-if="mode !== 'between'" :label="m.count">
        <DouInputNumber v-model="count" :min="1" :step="1" :precision="0" />
      </DouFormItem>
      <div v-else class="dou-pivot-top__range">
        <DouFormItem :label="m.min">
          <DouInputNumber v-model="min" />
        </DouFormItem>
        <DouFormItem :label="m.max">
          <DouInputNumber v-model="max" />
        </DouFormItem>
      </div>
      <p class="dou-pivot-top__help">{{ m.help }}</p>
    </DouForm>
    <template #footer="{ close }">
      <DouButton
        v-if="filter?.top || filter?.between"
        class="dou-pivot-top__clear"
        variant="ghost"
        @click="clear"
        >{{ m.clear }}</DouButton
      >
      <DouButton variant="outline" @click="close">{{ m.cancel }}</DouButton>
      <DouButton variant="solid" :disabled="!ready" @click="apply">{{ m.apply }}</DouButton>
    </template>
  </DouDialog>
</template>
