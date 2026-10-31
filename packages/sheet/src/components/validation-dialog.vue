<script setup lang="ts">
import {
  DouButton,
  DouCheckbox,
  DouDialog,
  DouForm,
  DouFormItem,
  DouInput,
  DouSelect,
} from 'dou-ui'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { parseRange } from '../core/address'
import { optionOf } from '../core/cell-type'
import type { SheetCondition, SheetValidation, SheetValue } from '../core/model'
import type { SheetMessages } from '../locale'

/*
 * Sets the validation rule of some cells: what they may hold, the hint
 * shown while one is active, and what is said when a value doesn't fit.
 */

const props = defineProps<{
  rule: SheetValidation
  /** Whether the rule is one the sheet has, which can be removed. */
  editing: boolean
  messages: SheetMessages
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [rule: SheetValidation]; remove: []; closed: [] }>()

const m = computed(() => props.messages.validation)

type Kind = keyof SheetMessages['validation']['kinds']
type Op = SheetCondition['op'] | 'any'
const NUMBER_OPS: Op[] = ['any', 'between', 'notBetween', 'eq', 'ne', 'gt', 'ge', 'lt', 'le']
const TEXT_OPS: Op[] = ['contains', 'notContains', 'begins', 'ends', 'eq', 'ne']

const target = ref('')
const kind = ref<Kind>('list')
const options = ref('')
const op = ref<Op>('between')
const value = ref('')
const to = ref('')
const formula = ref('')
const prompt = ref('')
const message = ref('')
const strict = ref(true)
const tried = ref(false)

const text = (v: SheetValue | undefined) => (v == null ? '' : String(v))
/** A list's options as typed: its values separated by commas, or its reference. */
function listText(list: Extract<SheetValidation, { list: unknown }>['list']) {
  return typeof list === 'string' ? list : list.map((o) => text(optionOf(o).value)).join(', ')
}

function kindOf(rule: SheetValidation): Kind {
  if ('list' in rule) return 'list'
  if ('formula' in rule) return 'formula'
  if (rule.integer) return 'integer'
  const { op: o, value: v, to: t } = rule.when
  if (typeof v === 'number' || typeof t === 'number' || o === 'notBlank') return 'number'
  return TEXT_OPS.includes(o) ? 'text' : 'number'
}

watch(open, (now) => {
  if (!now) return
  const r = props.rule
  target.value = r.range
  kind.value = kindOf(r)
  options.value = 'list' in r ? listText(r.list) : ''
  const when = 'when' in r ? r.when : undefined
  op.value = !when ? 'between' : when.op === 'notBlank' && kind.value !== 'text' ? 'any' : when.op
  value.value = text(when?.value)
  to.value = text(when?.to)
  formula.value = 'formula' in r ? r.formula : ''
  prompt.value = r.prompt ?? ''
  message.value = r.message ?? ''
  strict.value = r.strict !== false
  tried.value = false
})

// a condition that doesn't suit the kind picked starts over
watch(kind, (now) => {
  const ops = now === 'text' ? TEXT_OPS : NUMBER_OPS
  if (!ops.includes(op.value)) op.value = now === 'text' ? 'contains' : 'between'
})

const kindOptions = computed(() =>
  (Object.keys(m.value.kinds) as Kind[]).map((k) => ({ value: k, label: m.value.kinds[k] })),
)
const opOptions = computed(() =>
  (kind.value === 'text' ? TEXT_OPS : NUMBER_OPS).map((o) => ({
    value: o,
    label: o === 'any' ? m.value.any : props.messages.ops[o],
  })),
)

const numeric = computed(() => kind.value === 'number' || kind.value === 'integer')
const needsValue = computed(() => (kind.value === 'text' || numeric.value) && op.value !== 'any')
const needsTo = computed(() => op.value === 'between' || op.value === 'notBetween')

/** A number typed in a field, or `null`. */
function numberOf(input: string) {
  const n = Number(input.trim().replace(/,/g, ''))
  return input.trim() && Number.isFinite(n) ? n : null
}
/** A list option as typed: a number when it reads as one. */
function operand(input: string): SheetValue {
  return numberOf(input) ?? input.trim()
}

const rangeOk = computed(() => !!parseRange(target.value))
const optionsOk = computed(
  () => kind.value !== 'list' || options.value.trim().replace(/^=/, '') !== '',
)
const fieldOk = (input: string) => (numeric.value ? numberOf(input) != null : input.trim() !== '')
const valueOk = computed(
  () => !needsValue.value || (fieldOk(value.value) && (!needsTo.value || fieldOk(to.value))),
)
const formulaOk = computed(
  () => kind.value !== 'formula' || formula.value.trim().replace(/^=/, '') !== '',
)

function result(): SheetValidation {
  const base: Pick<SheetValidation, 'range' | 'strict' | 'prompt' | 'message'> = {
    range: target.value.trim().toUpperCase(),
  }
  if (!strict.value) base.strict = false
  if (prompt.value.trim()) base.prompt = prompt.value.trim()
  if (message.value.trim()) base.message = message.value.trim()
  const r = props.rule
  switch (kind.value) {
    case 'list': {
      const typed = options.value.trim()
      // options left as they were keep their tones
      if ('list' in r && typed === listText(r.list)) return { ...base, list: r.list }
      if (typed.startsWith('=')) return { ...base, list: typed }
      const list = typed
        .split(/[,，\n]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map(operand)
      return { ...base, list }
    }
    case 'formula': {
      const body = formula.value.trim()
      return { ...base, formula: body.startsWith('=') ? body : `=${body}` }
    }
    default: {
      const read = (input: string) => (numeric.value ? numberOf(input)! : input.trim())
      const when: SheetCondition =
        op.value === 'any' ? { op: 'notBlank' } : { op: op.value, value: read(value.value) }
      if (needsValue.value && needsTo.value) when.to = read(to.value)
      return kind.value === 'integer' ? { ...base, when, integer: true } : { ...base, when }
    }
  }
}

const rangeInput = useTemplateRef<InstanceType<typeof DouInput>>('rangeInput')
const optionsInput = useTemplateRef<InstanceType<typeof DouInput>>('optionsInput')
function focusFirst() {
  ;(optionsInput.value ?? rangeInput.value)?.focus()
}

function apply() {
  tried.value = true
  if (!rangeOk.value || !optionsOk.value || !valueOk.value || !formulaOk.value) return
  emit('apply', result())
  open.value = false
}
function remove() {
  emit('remove')
  open.value = false
}
</script>

<template>
  <DouDialog
    v-model:open="open"
    :title="m.title"
    :width="440"
    @opened="focusFirst"
    @closed="emit('closed')"
  >
    <DouForm layout="vertical" class="dou-sheet-format" @submit="apply">
      <DouFormItem :label="m.range" :error="tried && !rangeOk ? m.invalidRange : undefined">
        <DouInput ref="rangeInput" v-model="target" :invalid="tried && !rangeOk" />
      </DouFormItem>
      <DouFormItem :label="m.allow">
        <DouSelect v-model="kind" :options="kindOptions" />
      </DouFormItem>
      <DouFormItem
        v-if="kind === 'list'"
        :label="m.options"
        :help="m.optionsHelp"
        :error="tried && !optionsOk ? m.needOptions : undefined"
      >
        <DouInput
          ref="optionsInput"
          v-model="options"
          :invalid="tried && !optionsOk"
          @keydown.enter.prevent="apply"
        />
      </DouFormItem>
      <DouFormItem
        v-else-if="kind === 'formula'"
        :label="m.formula"
        :help="m.formulaHelp"
        :error="tried && !formulaOk ? m.needFormula : undefined"
      >
        <DouInput
          v-model="formula"
          spellcheck="false"
          autocomplete="off"
          :invalid="tried && !formulaOk"
          @keydown.enter.prevent="apply"
        />
      </DouFormItem>
      <template v-else>
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
              v-model="value"
              :aria-label="m.value"
              :inputmode="numeric ? 'decimal' : undefined"
              :invalid="tried && !fieldOk(value)"
              @keydown.enter.prevent="apply"
            />
            <template v-if="needsTo">
              <span class="dou-sheet-format__and">{{ m.and }}</span>
              <DouInput
                v-model="to"
                :aria-label="m.value"
                :inputmode="numeric ? 'decimal' : undefined"
                :invalid="tried && !fieldOk(to)"
                @keydown.enter.prevent="apply"
              />
            </template>
          </div>
        </DouFormItem>
      </template>
      <DouFormItem :label="m.prompt" :help="m.promptHelp">
        <DouInput v-model="prompt" />
      </DouFormItem>
      <DouFormItem :label="m.message" :help="m.messageHelp">
        <DouInput v-model="message" />
      </DouFormItem>
      <DouFormItem :help="m.strictHelp">
        <DouCheckbox v-model="strict">{{ m.strict }}</DouCheckbox>
      </DouFormItem>
    </DouForm>
    <template #footer="{ close }">
      <DouButton
        v-if="editing"
        variant="ghost"
        tone="danger"
        class="dou-sheet-validation__remove"
        @click="remove"
        >{{ m.remove }}</DouButton
      >
      <DouButton variant="outline" @click="close">{{ m.cancel }}</DouButton>
      <DouButton variant="solid" @click="apply">{{ m.apply }}</DouButton>
    </template>
  </DouDialog>
</template>
