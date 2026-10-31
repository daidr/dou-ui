<script setup lang="ts">
import {
  DouButton,
  DouCheckbox,
  DouDialog,
  DouForm,
  DouFormItem,
  DouInput,
  DouInputNumber,
  DouSegmentedControl,
  DouSelect,
} from 'dou-ui'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { parseRange } from '../core/address'
import type { SheetConditionalFormat, SheetStyle, SheetValue } from '../core/model'
import type { SheetMessages } from '../locale'

/*
 * Adds one conditional format of a kind picked in the toolbar's menu: the
 * cells it applies to, what they must meet, and how they look then.
 */

/** The kinds of format the dialog adds. */
export type SheetFormatKind =
  'gt' | 'lt' | 'between' | 'eq' | 'contains' | 'duplicates' | 'top' | 'bottom' | 'above' | 'below'

const props = defineProps<{
  kind: SheetFormatKind
  /** The cells it starts with: the selection. */
  range: string
  messages: SheetMessages
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [format: SheetConditionalFormat]; closed: [] }>()

const m = computed(() => props.messages.formats)

const LOOKS: Record<keyof SheetMessages['formats']['looks'], SheetStyle> = {
  danger: { fill: 'danger', tone: 'danger' },
  warning: { fill: 'warning', tone: 'warning' },
  success: { fill: 'success', tone: 'success' },
  dangerText: { tone: 'danger' },
  bold: { bold: true },
  neutral: { fill: 'neutral' },
}
const lookOptions = computed(() =>
  (Object.keys(LOOKS) as (keyof typeof LOOKS)[]).map((value) => ({
    value,
    label: m.value.looks[value],
  })),
)

/** The classes that show a look on a sample. */
function lookClass(name: string) {
  const style = LOOKS[name as keyof typeof LOOKS]
  return [
    style.fill && `is-fill-${style.fill}`,
    style.tone && `is-tone-${style.tone}`,
    style.bold && 'is-bold',
  ]
}

const target = ref('')
const value = ref('')
const to = ref('')
const count = ref<number | null>(10)
const percent = ref(false)
const repeated = ref<'repeated' | 'unique'>('repeated')
const look = ref<keyof typeof LOOKS>('danger')
const tried = ref(false)

watch(open, (now) => {
  if (!now) return
  target.value = props.range
  value.value = ''
  to.value = ''
  count.value = 10
  percent.value = false
  repeated.value = 'repeated'
  look.value = 'danger'
  tried.value = false
})

const title = computed(() => m.value[props.kind].replace(/…$/, ''))
const needsValue = computed(() => ['gt', 'lt', 'eq', 'contains', 'between'].includes(props.kind))
const rangeOk = computed(() => !!parseRange(target.value))
const valueOk = computed(
  () =>
    !needsValue.value ||
    (value.value.trim() !== '' && (props.kind !== 'between' || to.value.trim() !== '')),
)
const countOk = computed(
  () => (props.kind !== 'top' && props.kind !== 'bottom') || (count.value ?? 0) >= 1,
)

/** A typed operand: a number when it reads as one, otherwise the text. */
function operand(text: string): SheetValue {
  const trimmed = text.trim()
  const n = Number(trimmed.replace(/,/g, ''))
  return trimmed && Number.isFinite(n) && /\d/.test(trimmed) ? n : trimmed
}

function result(): SheetConditionalFormat {
  const range = target.value.trim().toUpperCase()
  const style = { ...LOOKS[look.value] }
  switch (props.kind) {
    case 'gt':
    case 'lt':
    case 'eq':
    case 'contains':
      return { range, when: { op: props.kind, value: operand(value.value) }, style }
    case 'between':
      return {
        range,
        when: { op: 'between', value: operand(value.value), to: operand(to.value) },
        style,
      }
    case 'duplicates':
      return { range, duplicates: repeated.value === 'repeated', style }
    case 'top':
    case 'bottom': {
      const n = Math.round(count.value!)
      const rank = props.kind === 'top' ? { top: n } : { bottom: n }
      return { range, ...rank, ...(percent.value && { percent: true }), style }
    }
    case 'above':
    case 'below':
      return { range, average: props.kind, style }
  }
}

// the first thing to fill in takes the focus, not the close button
const rangeInput = useTemplateRef<InstanceType<typeof DouInput>>('rangeInput')
const valueInput = useTemplateRef<InstanceType<typeof DouInput>>('valueInput')
const countInput = useTemplateRef<InstanceType<typeof DouInputNumber>>('countInput')
function focusFirst() {
  ;(valueInput.value ?? countInput.value ?? rangeInput.value)?.focus()
}

function apply() {
  tried.value = true
  if (!rangeOk.value || !valueOk.value || !countOk.value) return
  emit('apply', result())
  open.value = false
}
</script>

<template>
  <DouDialog
    v-model:open="open"
    :title="title"
    :width="400"
    @opened="focusFirst"
    @closed="emit('closed')"
  >
    <DouForm layout="vertical" class="dou-sheet-format" @submit="apply">
      <DouFormItem :label="m.range" :error="tried && !rangeOk ? m.invalidRange : undefined">
        <DouInput ref="rangeInput" v-model="target" :invalid="tried && !rangeOk" />
      </DouFormItem>
      <DouFormItem
        v-if="needsValue"
        :label="messages.ops[kind as 'gt']"
        :error="tried && !valueOk ? m.needValue : undefined"
      >
        <div class="dou-sheet-format__values">
          <DouInput
            ref="valueInput"
            v-model="value"
            :aria-label="m.value"
            :invalid="tried && !value.trim()"
            @keydown.enter.prevent="apply"
          />
          <template v-if="kind === 'between'">
            <span class="dou-sheet-format__and">{{ m.and }}</span>
            <DouInput
              v-model="to"
              :aria-label="m.value"
              :invalid="tried && !to.trim()"
              @keydown.enter.prevent="apply"
            />
          </template>
        </div>
      </DouFormItem>
      <DouFormItem v-if="kind === 'top' || kind === 'bottom'" :label="m.count">
        <div class="dou-sheet-format__values">
          <DouInputNumber ref="countInput" v-model="count" :min="1" :step="1" :precision="0" />
          <DouCheckbox v-model="percent">{{ m.percent }}</DouCheckbox>
        </div>
      </DouFormItem>
      <DouSegmentedControl
        v-if="kind === 'duplicates'"
        v-model="repeated"
        block
        :options="[
          { value: 'repeated', label: m.repeated },
          { value: 'unique', label: m.unique },
        ]"
      />
      <DouFormItem :label="m.look">
        <DouSelect v-model="look" :options="lookOptions">
          <template #option="{ option }">
            <span class="dou-sheet-format__look">
              <span
                class="dou-sheet-format__sample"
                :class="lookClass(String(option.value))"
                aria-hidden="true"
                >123</span
              >
              {{ option.label }}
            </span>
          </template>
          <template #label="{ option }">
            <span class="dou-sheet-format__look">
              <span
                class="dou-sheet-format__sample"
                :class="lookClass(String(option.value))"
                aria-hidden="true"
                >123</span
              >
              {{ option.label }}
            </span>
          </template>
        </DouSelect>
      </DouFormItem>
    </DouForm>
    <template #footer="{ close }">
      <DouButton variant="outline" @click="close">{{ m.cancel }}</DouButton>
      <DouButton variant="solid" @click="apply">{{ m.apply }}</DouButton>
    </template>
  </DouDialog>
</template>
