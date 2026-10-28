<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import type { HTMLAttributes } from 'vue'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import { DouTag } from '../tag'
import type { SelectExpose, SelectOption, SelectProps, SelectSlots, SelectValue } from './select'

defineOptions({ name: 'DouSelect' })

const props = withDefaults(defineProps<SelectProps>(), {
  multiple: false,
  filterable: false,
  disabled: false,
  invalid: false,
  clearable: false,
  placement: 'bottom-start',
  teleport: 'body',
})
const model = defineModel<SelectValue | SelectValue[] | null>()
const emit = defineEmits<{ change: [value: SelectValue | SelectValue[] | null]; clear: [] }>()
const slots = defineSlots<SelectSlots>()

const ns = useNamespace('select')
const { t } = useLocale()
const { formItem } = useFormItem()
// A plain combobox is not labelable, so the item names it by id instead.
if (!props.filterable) formItem?.markGroup()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)

const id = `dou-select-${useId()}`
const listboxId = `${id}-listbox`
const optionId = (index: number) => `${id}-option-${index}`

const options = computed<SelectOption[]>(() =>
  props.options.map((option) =>
    typeof option === 'object' ? option : { value: option, label: String(option) },
  ),
)
const labelOf = (option: SelectOption) => option.label ?? String(option.value)

const selected = computed<SelectValue[]>(() => {
  const value = model.value
  if (props.multiple) return Array.isArray(value) ? value : []
  return value === null || value === undefined || Array.isArray(value) ? [] : [value]
})
const isSelected = (option: SelectOption) => selected.value.includes(option.value)
const selectedOptions = computed(() =>
  selected.value.map(
    (value) => options.value.find((option) => option.value === value) ?? { value },
  ),
)
const hasValue = computed(() => selected.value.length > 0)

const query = ref('')
const filtered = computed(() => {
  const text = query.value.trim().toLowerCase()
  if (!props.filterable || !text) return options.value
  return options.value.filter((option) => labelOf(option).toLowerCase().includes(text))
})

const open = ref(false)
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

// The highlighted option. Focus stays in the field; the list follows
// through `aria-activedescendant`.
const active = ref(-1)
const enabled = (index: number) => !!filtered.value[index] && !filtered.value[index]!.disabled

function move(from: number, step: 1 | -1) {
  const count = filtered.value.length
  for (let offset = 1; offset <= count; offset++) {
    const index = (((from + step * offset) % count) + count) % count
    if (enabled(index)) {
      active.value = index
      return
    }
  }
}
function edge(which: 'first' | 'last') {
  move(which === 'first' ? -1 : filtered.value.length, which === 'first' ? 1 : -1)
}

function show() {
  if (disabled.value || open.value) return
  open.value = true
  const index = filtered.value.findIndex(isSelected)
  if (index >= 0 && enabled(index)) active.value = index
  else edge('first')
}
function hide() {
  open.value = false
  query.value = ''
}

watch(open, (value) => {
  if (!value) query.value = ''
})
watch(filtered, () => {
  if (open.value) edge('first')
})
watch(active, async (index) => {
  await nextTick()
  panelRef.value?.querySelector(`#${CSS.escape(optionId(index))}`)?.scrollIntoView?.({
    block: 'nearest',
  })
})

function commit(value: SelectValue | SelectValue[] | null) {
  model.value = value
  emit('change', value)
  formItem?.trigger('change')
}

function choose(option: SelectOption | undefined) {
  if (!option || option.disabled) return
  if (props.multiple) {
    const values = isSelected(option)
      ? selected.value.filter((value) => value !== option.value)
      : [...selected.value, option.value]
    commit(values)
    query.value = ''
  } else {
    if (option.value !== model.value) commit(option.value)
    hide()
  }
}

function remove(value: SelectValue) {
  if (disabled.value) return
  commit(selected.value.filter((item) => item !== value))
}

function clear() {
  commit(props.multiple ? [] : null)
  emit('clear')
  hide()
  focus()
}

const fieldRef = useTemplateRef<HTMLElement>('field')
const inputRef = useTemplateRef<HTMLInputElement>('input')
const combobox = () => (props.filterable ? inputRef.value : fieldRef.value)
function focus() {
  combobox()?.focus()
}

let typed = ''
let typedTimer: ReturnType<typeof setTimeout> | undefined

function onKeydown(event: KeyboardEvent) {
  if (disabled.value) return
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      event.preventDefault()
      if (!open.value) show()
      else move(active.value, event.key === 'ArrowDown' ? 1 : -1)
      return
    case 'Home':
    case 'End':
      if (!open.value || props.filterable) return
      event.preventDefault()
      edge(event.key === 'Home' ? 'first' : 'last')
      return
    case 'Enter':
      event.preventDefault()
      if (open.value) choose(filtered.value[active.value])
      else show()
      return
    case ' ':
      if (props.filterable) return
      event.preventDefault()
      if (open.value) choose(filtered.value[active.value])
      else show()
      return
    case 'Tab':
      hide()
      return
    case 'Backspace':
      if (props.multiple && props.filterable && !query.value && selected.value.length) {
        remove(selected.value.at(-1)!)
      }
      return
  }

  // Without a search box, typing jumps to the next option starting with it.
  if (props.filterable || event.key.length !== 1 || event.ctrlKey || event.metaKey) return
  clearTimeout(typedTimer)
  typed += event.key.toLowerCase()
  typedTimer = setTimeout(() => (typed = ''), 500)
  show()
  const count = filtered.value.length
  for (let offset = typed.length > 1 ? 0 : 1; offset <= count; offset++) {
    const index = (active.value + offset) % count
    if (enabled(index) && labelOf(filtered.value[index]!).toLowerCase().startsWith(typed)) {
      active.value = index
      return
    }
  }
}

function onInput() {
  show()
}

// Pressing anywhere on the field toggles the list and keeps focus in it;
// buttons inside (clear, tag removal) act on their own.
function onFieldMousedown(event: MouseEvent) {
  if (disabled.value) return
  const target = event.target as HTMLElement
  if (target.closest('button')) return
  if (target !== inputRef.value) event.preventDefault()
  focus()
  if (open.value && target !== inputRef.value) hide()
  else show()
}

function onBlur(event: FocusEvent) {
  const next = event.relatedTarget
  if (next instanceof Node && (fieldRef.value?.contains(next) || panelRef.value?.contains(next))) {
    return
  }
  hide()
  formItem?.trigger('blur')
}

const comboboxAttrs = computed<HTMLAttributes>(() => ({
  role: 'combobox',
  'aria-haspopup': 'listbox',
  'aria-expanded': open.value,
  'aria-controls': rendered.value ? listboxId : undefined,
  'aria-activedescendant': open.value && active.value >= 0 ? optionId(active.value) : undefined,
  'aria-disabled': disabled.value || undefined,
  'aria-invalid': invalid.value || undefined,
  'aria-required': formItem?.required.value || undefined,
  'aria-describedby': formItem?.describedBy.value,
  'aria-label': props.ariaLabel,
}))

const singleLabel = computed(() =>
  !props.multiple && selectedOptions.value[0] ? labelOf(selectedOptions.value[0]) : '',
)
const placeholderText = computed(() => props.placeholder ?? t('select.placeholder'))
const inputPlaceholder = computed(() => {
  if (props.multiple) return hasValue.value ? '' : placeholderText.value
  return singleLabel.value || placeholderText.value
})

const showClear = computed(() => props.clearable && !disabled.value && hasValue.value)
const tagSize = computed(() => size.value)

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('multiple', props.multiple),
  ns.is('filterable', props.filterable),
  ns.is('open', open.value),
  ns.is('disabled', disabled.value),
  ns.is('invalid', invalid.value),
  ns.is('selected', hasValue.value),
])

defineExpose<SelectExpose>({ focus, blur: () => combobox()?.blur() })
</script>

<template>
  <OnlyChild ref="triggerRef">
    <div
      ref="field"
      :class="classes"
      v-bind="filterable ? {} : comboboxAttrs"
      :id="filterable ? undefined : formItem?.inputId"
      :aria-labelledby="filterable ? undefined : formItem?.labelId"
      :tabindex="filterable || disabled ? undefined : 0"
      @mousedown="onFieldMousedown"
      @keydown="filterable ? undefined : onKeydown($event)"
      @focusout="onBlur"
    >
      <span v-if="slots.prefix" :class="ns.e('prefix')"><slot name="prefix" /></span>
      <div :class="ns.e('selection')">
        <template v-if="multiple">
          <DouTag
            v-for="option in selectedOptions"
            :key="String(option.value)"
            :size="tagSize"
            :closable="!disabled"
            :class="ns.e('tag')"
            @close="remove(option.value)"
          >
            {{ labelOf(option) }}
          </DouTag>
        </template>
        <input
          v-if="filterable"
          ref="input"
          v-model="query"
          v-bind="comboboxAttrs"
          :id="formItem?.inputId"
          :class="ns.e('input')"
          type="text"
          autocomplete="off"
          aria-autocomplete="list"
          :placeholder="inputPlaceholder"
          :disabled="disabled"
          @input="onInput"
          @keydown="onKeydown"
        />
        <span v-else-if="!multiple && hasValue" :class="ns.e('value')">{{ singleLabel }}</span>
        <span v-else-if="!hasValue" :class="ns.e('placeholder')">{{ placeholderText }}</span>
      </div>
      <button
        v-if="showClear"
        type="button"
        tabindex="-1"
        :class="ns.e('clear')"
        :aria-label="t('select.clear')"
        @mousedown.prevent
        @click="clear"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M5 5l6 6M11 5l-6 6" stroke-linecap="round" />
        </svg>
      </button>
      <svg
        :class="ns.e('arrow')"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        aria-hidden="true"
      >
        <path d="M4.5 6.25L8 9.75l3.5-3.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
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
        <ul
          :id="listboxId"
          role="listbox"
          :class="ns.e('list')"
          :aria-multiselectable="multiple || undefined"
          :aria-labelledby="formItem?.labelId"
        >
          <li
            v-for="(option, index) in filtered"
            :id="optionId(index)"
            :key="String(option.value)"
            role="option"
            :aria-selected="isSelected(option)"
            :aria-disabled="option.disabled || undefined"
            :class="[
              ns.e('option'),
              ns.is('active', index === active),
              ns.is('selected', isSelected(option)),
              ns.is('disabled', !!option.disabled),
            ]"
            @click="choose(option)"
            @mousemove="!option.disabled && (active = index)"
          >
            <span :class="ns.e('option-label')">
              <slot name="option" :option="option" :selected="isSelected(option)">
                {{ labelOf(option) }}
              </slot>
            </span>
            <svg
              v-if="isSelected(option)"
              :class="ns.e('check')"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              aria-hidden="true"
            >
              <path d="M3.5 8.5l3 3 6-7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </li>
        </ul>
        <div v-if="!filtered.length" :class="ns.e('empty')">
          <slot name="empty">{{ t('select.empty') }}</slot>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
