<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled } from '../form/use-form-item'
import { DouInput } from '../input'
import type { InputExpose } from '../input'
import { DouSpinner } from '../spinner'
import type {
  AutocompleteExpose,
  AutocompleteOption,
  AutocompleteProps,
  AutocompleteSlots,
  AutocompleteSource,
} from './autocomplete'

// Attributes go to the input, which hands class and style to its frame.
defineOptions({ name: 'DouAutocomplete', inheritAttrs: false })

const props = withDefaults(defineProps<AutocompleteProps>(), {
  options: () => [],
  filter: true,
  debounce: 200,
  minLength: 0,
  highlight: true,
  disabled: false,
  invalid: false,
  clearable: false,
  placement: 'bottom-start',
  teleport: 'body',
})
const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ select: [option: AutocompleteOption] }>()
const slots = defineSlots<AutocompleteSlots>()

const ns = useNamespace('autocomplete')
const { t } = useLocale()
const disabled = useFormDisabled(() => props.disabled)

const id = `dou-autocomplete-${useId()}`
const listboxId = `${id}-listbox`
const optionId = (index: number) => `${id}-option-${index}`

const normalize = (source: AutocompleteSource): AutocompleteOption[] =>
  source.map((option) => (typeof option === 'string' ? { value: option } : option))
const labelOf = (option: AutocompleteOption) => option.label ?? option.value

/* suggestions */

const fetched = ref<AutocompleteOption[]>([])
const loading = ref(false)
let request = 0
let timer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(timer))

const enough = computed(() => model.value.length >= props.minLength)

const suggestions = computed<AutocompleteOption[]>(() => {
  if (!enough.value) return []
  if (props.fetch) return fetched.value
  const options = normalize(props.options)
  const query = model.value.trim().toLowerCase()
  if (props.filter === false || !query) return options
  if (typeof props.filter === 'function') {
    const filter = props.filter
    return options.filter((option) => filter(option, model.value))
  }
  return options.filter((option) => labelOf(option).toLowerCase().includes(query))
})

function load(immediate = false) {
  if (!props.fetch) return
  clearTimeout(timer)
  if (!enough.value) {
    request++
    fetched.value = []
    loading.value = false
    return
  }
  const query = model.value
  const run = async () => {
    const current = ++request
    loading.value = true
    try {
      const result = await props.fetch!(query)
      if (current === request) fetched.value = normalize(result)
    } catch {
      if (current === request) fetched.value = []
    } finally {
      if (current === request) loading.value = false
    }
  }
  if (immediate || props.debounce <= 0) void run()
  else timer = setTimeout(run, props.debounce)
}

/* the popup */

const focused = ref(false)
const wanted = ref(false)
const open = computed({
  get: () =>
    wanted.value &&
    focused.value &&
    !disabled.value &&
    (loading.value || suggestions.value.length > 0 || (!!slots.empty && enough.value)),
  set: (value) => (wanted.value = value),
})
const popup = usePopup({
  open,
  trigger: 'manual',
  closeOnOutside: true,
  disabled,
  placement: () => props.placement,
  offset: 4,
  sameWidth: true,
})
const { triggerRef, panelRef, rendered, theme, placement, panelStyle } = popup

const active = ref(-1)
watch(suggestions, () => (active.value = -1))
watch(active, async (index) => {
  await nextTick()
  panelRef.value?.querySelector(`#${CSS.escape(optionId(index))}`)?.scrollIntoView?.({
    block: 'nearest',
  })
})

function move(step: 1 | -1) {
  const list = suggestions.value
  for (let offset = 1; offset <= list.length; offset++) {
    const index = (((active.value + step * offset) % list.length) + list.length) % list.length
    if (!list[index]!.disabled) {
      active.value = index
      return
    }
  }
}

const inputRef = useTemplateRef<InputExpose>('input')

function choose(option: AutocompleteOption | undefined) {
  if (!option || option.disabled) return
  model.value = option.value
  emit('select', option)
  wanted.value = false
  active.value = -1
}

// A bound value comes back from the parent on the next render.
async function onInput() {
  wanted.value = true
  await nextTick()
  load()
}

function onFocus() {
  focused.value = true
  wanted.value = true
  if (props.fetch && !fetched.value.length) load(true)
}

function onBlur(event: FocusEvent) {
  const next = event.relatedTarget
  if (next instanceof Node && panelRef.value?.contains(next)) return
  focused.value = false
  wanted.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (disabled.value) return
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      event.preventDefault()
      if (!open.value) {
        wanted.value = true
        return
      }
      move(event.key === 'ArrowDown' ? 1 : -1)
      return
    case 'Enter':
      // Without a highlighted suggestion Enter is left to the form.
      if (open.value && active.value >= 0) {
        event.preventDefault()
        choose(suggestions.value[active.value])
      }
      return
    case 'Escape':
      if (open.value) {
        event.preventDefault()
        wanted.value = false
      }
      return
    case 'Tab':
      wanted.value = false
  }
}

/** The label split around the first match of the text. */
function parts(option: AutocompleteOption) {
  const label = labelOf(option)
  const query = model.value.trim()
  const at = props.highlight && query ? label.toLowerCase().indexOf(query.toLowerCase()) : -1
  if (at < 0) return [{ text: label, match: false }]
  return [
    { text: label.slice(0, at), match: false },
    { text: label.slice(at, at + query.length), match: true },
    { text: label.slice(at + query.length), match: false },
  ].filter((part) => part.text)
}

const inputAttrs = computed(() => ({
  role: 'combobox',
  autocomplete: 'off',
  'aria-autocomplete': 'list',
  'aria-haspopup': 'listbox',
  'aria-expanded': open.value,
  'aria-controls': rendered.value ? listboxId : undefined,
  'aria-activedescendant': open.value && active.value >= 0 ? optionId(active.value) : undefined,
}))

defineExpose<AutocompleteExpose>({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
})
</script>

<template>
  <OnlyChild ref="triggerRef">
    <DouInput
      ref="input"
      v-model="model"
      v-bind="{ ...$attrs, ...inputAttrs }"
      :class="ns.b()"
      :size="size"
      :disabled="disabled"
      :invalid="invalid"
      :clearable="clearable"
      :placeholder="placeholder"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeydown"
      @clear="onInput"
    >
      <template v-if="slots.prefix" #prefix><slot name="prefix" /></template>
    </DouInput>
  </OnlyChild>
  <Teleport v-if="rendered" :to="teleport || 'body'" :disabled="teleport === false">
    <Transition name="dou-floating">
      <div
        v-show="open"
        ref="panelRef"
        :class="[ns.e('menu'), 'dou-floating']"
        :style="panelStyle"
        :data-placement="placement"
        :data-dou-theme="theme"
        @mousedown.prevent
      >
        <ul :id="listboxId" role="listbox" :class="ns.e('list')" :aria-busy="loading || undefined">
          <li
            v-for="(option, index) in suggestions"
            :id="optionId(index)"
            :key="option.value"
            role="option"
            :aria-selected="index === active"
            :aria-disabled="option.disabled || undefined"
            :class="[
              ns.e('option'),
              ns.is('active', index === active),
              ns.is('disabled', !!option.disabled),
            ]"
            @click="choose(option)"
            @mousemove="!option.disabled && (active = index)"
          >
            <slot name="option" :option="option" :query="model">
              <span :class="ns.e('label')">
                <template v-for="(part, i) in parts(option)" :key="i">
                  <mark v-if="part.match" :class="ns.e('match')">{{ part.text }}</mark>
                  <template v-else>{{ part.text }}</template>
                </template>
              </span>
              <span v-if="option.description" :class="ns.e('description')">
                {{ option.description }}
              </span>
            </slot>
          </li>
        </ul>
        <div v-if="loading && !suggestions.length" :class="ns.e('status')">
          <DouSpinner size="sm" />
          {{ t('autocomplete.loading') }}
        </div>
        <div v-else-if="!loading && !suggestions.length" :class="ns.e('status')">
          <slot name="empty" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
