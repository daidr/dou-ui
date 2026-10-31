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
  type Tone,
} from 'dou-ui'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { readRuleRange, ruleRangeText } from '../core/conditional'
import type {
  SheetColor,
  SheetCondition,
  SheetConditionalFormat,
  SheetConditionalStyle,
  SheetStyle,
  SheetValue,
} from '../core/model'
import type { SheetMessages } from '../locale'
import {
  barSwatch,
  LOOKS,
  lookName,
  SCALES,
  scaleName,
  scaleSwatch,
  styleSample,
  TONES,
  toneKey,
  type SheetLookName,
  type SheetScaleColors,
  type SheetScaleName,
} from './format-presets'

/*
 * Adds or edits one conditional format: the cells it applies to, what
 * they must meet, and how they look then. It starts from `format`, which
 * the toolbar's menu fills in for a new rule.
 */

const props = defineProps<{
  format: SheetConditionalFormat
  title: string
  /** The workbook's named styles, for a rule that names one. */
  styles: Record<string, SheetStyle> | undefined
  messages: SheetMessages
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [format: SheetConditionalFormat]; closed: [] }>()

const m = computed(() => props.messages.formats)

type Kind = 'when' | 'formula' | 'duplicates' | 'rank' | 'average' | 'scale' | 'bar'
function kindOf(f: SheetConditionalFormat): Kind {
  if ('when' in f) return 'when'
  if ('formula' in f) return 'formula'
  if ('duplicates' in f || 'unique' in f) return 'duplicates'
  if ('top' in f || 'bottom' in f) return 'rank'
  if ('average' in f) return 'average'
  return 'scale' in f ? 'scale' : 'bar'
}
const kind = computed(() => kindOf(props.format))

const OPS: SheetCondition['op'][] = [
  'gt',
  'ge',
  'lt',
  'le',
  'eq',
  'ne',
  'between',
  'notBetween',
  'contains',
  'notContains',
  'begins',
  'ends',
  'blank',
  'notBlank',
]
const opOptions = computed(() => OPS.map((value) => ({ value, label: props.messages.ops[value] })))

const target = ref('')
const op = ref<SheetCondition['op']>('gt')
const value = ref('')
const to = ref('')
const formula = ref('')
const count = ref<number | null>(10)
const percent = ref(false)
const repeated = ref<'repeated' | 'unique'>('repeated')
const look = ref<SheetLookName | 'current'>('danger')
const scale = ref<SheetScaleName | 'current'>('rag')
const bar = ref<Tone | 'current'>('neutral')
const tried = ref(false)

const text = (v: SheetValue | undefined) => (v == null ? '' : String(v))

/** The rule's own look, when it isn't one the dialog offers. */
const current = computed<SheetConditionalStyle | undefined>(() => {
  const f = props.format
  if (!('style' in f)) return undefined
  const style = typeof f.style === 'string' ? undefined : f.style
  return style && lookName(style) ? undefined : f.style
})
const resolve = (style: SheetConditionalStyle | undefined) =>
  typeof style === 'string' ? props.styles?.[style] : style

watch(open, (now) => {
  if (!now) return
  const f = props.format
  target.value = ruleRangeText(f.range)
  op.value = 'when' in f ? f.when.op : 'gt'
  value.value = 'when' in f ? text(f.when.value) : ''
  to.value = 'when' in f ? text(f.when.to) : ''
  formula.value = 'formula' in f ? f.formula : ''
  count.value = 'top' in f && f.top != null ? f.top : 'bottom' in f ? (f.bottom ?? 10) : 10
  percent.value = 'percent' in f && !!f.percent
  repeated.value = 'unique' in f ? 'unique' : 'repeated'
  look.value =
    'style' in f
      ? ((typeof f.style === 'string' ? undefined : lookName(f.style)) ?? 'current')
      : 'danger'
  scale.value = 'scale' in f ? (scaleName(f.scale) ?? 'current') : 'rag'
  bar.value =
    'bar' in f
      ? f.bar === true
        ? 'neutral'
        : TONES.includes(f.bar as Tone)
          ? (f.bar as Tone)
          : 'current'
      : 'neutral'
  tried.value = false
})

const lookOptions = computed(() => [
  ...(current.value === undefined ? [] : [{ value: 'current', label: m.value.current }]),
  ...(Object.keys(LOOKS) as SheetLookName[]).map((name) => ({
    value: name,
    label: m.value.looks[name],
  })),
])
function lookSample(name: string) {
  return styleSample(name === 'current' ? resolve(current.value) : LOOKS[name as SheetLookName])
}

const scaleOptions = computed(() => [
  ...('scale' in props.format && !scaleName(props.format.scale)
    ? [{ value: 'current', label: m.value.current }]
    : []),
  ...(Object.keys(SCALES) as SheetScaleName[]).map((name) => ({
    value: name,
    label: m.value.scales[name],
  })),
])
function scaleColors(name: string): readonly SheetColor[] {
  if (name !== 'current') return SCALES[name as SheetScaleName]
  return 'scale' in props.format ? props.format.scale : SCALES.rag
}

const barOptions = computed(() => [
  ...('bar' in props.format &&
  props.format.bar !== true &&
  !TONES.includes(props.format.bar as Tone)
    ? [{ value: 'current', label: m.value.current }]
    : []),
  ...TONES.map((tone) => ({ value: tone, label: props.messages[toneKey(tone)] })),
])
function barOf(name: string): SheetColor {
  if (name !== 'current') return name
  return 'bar' in props.format && props.format.bar !== true ? props.format.bar : 'neutral'
}

const needsValue = computed(
  () => kind.value === 'when' && op.value !== 'blank' && op.value !== 'notBlank',
)
const needsTo = computed(() => op.value === 'between' || op.value === 'notBetween')
const rangeOk = computed(() => readRuleRange(target.value) != null)
const valueOk = computed(
  () =>
    !needsValue.value || (value.value.trim() !== '' && (!needsTo.value || to.value.trim() !== '')),
)
const formulaOk = computed(
  () => kind.value !== 'formula' || formula.value.trim().replace(/^=/, '') !== '',
)
const countOk = computed(() => kind.value !== 'rank' || (count.value ?? 0) >= 1)

/** A typed operand: a number when it reads as one, otherwise the text. */
function operand(input: string): SheetValue {
  const trimmed = input.trim()
  const n = Number(trimmed.replace(/,/g, ''))
  return trimmed && Number.isFinite(n) && /\d/.test(trimmed) ? n : trimmed
}

function result(): SheetConditionalFormat {
  const f = props.format
  const range = readRuleRange(target.value)!
  const style: SheetConditionalStyle =
    look.value === 'current' && current.value !== undefined
      ? current.value
      : { ...LOOKS[look.value as SheetLookName] }
  switch (kind.value) {
    case 'when': {
      const when: SheetCondition = { op: op.value }
      if (needsValue.value) when.value = operand(value.value)
      if (needsValue.value && needsTo.value) when.to = operand(to.value)
      return { range, when, style }
    }
    case 'formula': {
      const body = formula.value.trim()
      return { range, formula: body.startsWith('=') ? body : `=${body}`, style }
    }
    case 'duplicates':
      return repeated.value === 'repeated'
        ? { range, duplicates: true, style }
        : { range, unique: true, style }
    case 'rank': {
      const n = Math.round(count.value!)
      const rank = 'bottom' in f && f.bottom != null ? { bottom: n } : { top: n }
      return { range, ...rank, ...(percent.value && { percent: true }), style }
    }
    case 'average':
      return { range, average: 'average' in f ? f.average : 'above', style }
    case 'scale':
      return { range, scale: [...scaleColors(scale.value)] as SheetScaleColors }
    case 'bar':
      return {
        range,
        bar: bar.value === 'neutral' && 'bar' in f && f.bar === true ? true : barOf(bar.value),
      }
  }
}

// the first thing to fill in takes the focus, not the close button
const rangeInput = useTemplateRef<InstanceType<typeof DouInput>>('rangeInput')
const valueInput = useTemplateRef<InstanceType<typeof DouInput>>('valueInput')
const formulaInput = useTemplateRef<InstanceType<typeof DouInput>>('formulaInput')
const countInput = useTemplateRef<InstanceType<typeof DouInputNumber>>('countInput')
function focusFirst() {
  ;(valueInput.value ?? formulaInput.value ?? countInput.value ?? rangeInput.value)?.focus()
}

function apply() {
  tried.value = true
  if (!rangeOk.value || !valueOk.value || !formulaOk.value || !countOk.value) return
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
      <template v-if="kind === 'when'">
        <DouFormItem :label="m.condition">
          <DouSelect v-model="op" :options="opOptions" />
        </DouFormItem>
        <DouFormItem
          v-if="needsValue"
          :label="m.value"
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
            <template v-if="needsTo">
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
      </template>
      <DouFormItem
        v-if="kind === 'formula'"
        :label="m.formulaField"
        :help="m.formulaHelp"
        :error="tried && !formulaOk ? m.needFormula : undefined"
      >
        <DouInput
          ref="formulaInput"
          v-model="formula"
          class="dou-sheet-format__formula"
          spellcheck="false"
          autocomplete="off"
          :invalid="tried && !formulaOk"
          @keydown.enter.prevent="apply"
        />
      </DouFormItem>
      <DouFormItem v-if="kind === 'rank'" :label="m.count">
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
      <DouFormItem v-if="kind === 'scale'" :label="m.color">
        <DouSelect v-model="scale" :options="scaleOptions">
          <template #option="{ option }">
            <span class="dou-sheet-format__look">
              <span
                class="dou-sheet-format__sample"
                :style="{ backgroundImage: scaleSwatch(scaleColors(String(option.value))) }"
                aria-hidden="true"
              />
              {{ option.label }}
            </span>
          </template>
          <template #label="{ option }">
            <span class="dou-sheet-format__look">
              <span
                class="dou-sheet-format__sample"
                :style="{ backgroundImage: scaleSwatch(scaleColors(String(option.value))) }"
                aria-hidden="true"
              />
              {{ option.label }}
            </span>
          </template>
        </DouSelect>
      </DouFormItem>
      <DouFormItem v-else-if="kind === 'bar'" :label="m.color">
        <DouSelect v-model="bar" :options="barOptions">
          <template #option="{ option }">
            <span class="dou-sheet-format__look">
              <span
                class="dou-sheet-format__sample is-bar"
                :style="{ backgroundImage: barSwatch(barOf(String(option.value))) }"
                aria-hidden="true"
              />
              {{ option.label }}
            </span>
          </template>
          <template #label="{ option }">
            <span class="dou-sheet-format__look">
              <span
                class="dou-sheet-format__sample is-bar"
                :style="{ backgroundImage: barSwatch(barOf(String(option.value))) }"
                aria-hidden="true"
              />
              {{ option.label }}
            </span>
          </template>
        </DouSelect>
      </DouFormItem>
      <DouFormItem v-else :label="m.look">
        <DouSelect v-model="look" :options="lookOptions">
          <template #option="{ option }">
            <span class="dou-sheet-format__look">
              <span
                class="dou-sheet-format__sample"
                :class="lookSample(String(option.value)).cls"
                :style="lookSample(String(option.value)).css"
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
                :class="lookSample(String(option.value)).cls"
                :style="lookSample(String(option.value)).css"
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
