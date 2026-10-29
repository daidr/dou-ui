<script setup lang="ts">
import { CheckIcon, SearchIcon } from '@dou-ui/icons'
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import type {
  ListboxExpose,
  ListboxOption,
  ListboxOptionGroup,
  ListboxProps,
  ListboxSlots,
  ListboxValue,
} from './listbox'

defineOptions({ name: 'DouListbox' })

const props = withDefaults(defineProps<ListboxProps>(), {
  multiple: false,
  filterable: false,
  disabled: false,
})
const model = defineModel<ListboxValue | ListboxValue[] | null>()
const emit = defineEmits<{ change: [value: ListboxValue | ListboxValue[] | null] }>()
const slots = defineSlots<ListboxSlots>()

const ns = useNamespace('listbox')
const { t } = useLocale()
const { formItem } = useFormItem()
// A list is not labelable, so the item names it by id instead.
formItem?.markGroup()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)

const id = `dou-listbox-${useId()}`
const optionId = (index: number) => `${id}-option-${index}`

const toOption = (option: ListboxOption | string | number): ListboxOption =>
  typeof option === 'object' ? option : { value: option, label: String(option) }
const isGroup = (
  entry: ListboxOption | ListboxOptionGroup | string | number,
): entry is ListboxOptionGroup =>
  typeof entry === 'object' && Array.isArray((entry as ListboxOptionGroup).options)
const labelOf = (option: ListboxOption) => option.label ?? String(option.value)

interface Section {
  key: string
  label?: string
  options: ListboxOption[]
}

const sections = computed<Section[]>(() => {
  const result: Section[] = []
  let loose: Section | undefined
  for (const [index, entry] of props.options.entries()) {
    if (isGroup(entry)) {
      loose = undefined
      result.push({
        key: `group-${index}`,
        label: entry.label,
        options: entry.options.map((option) => {
          const normalized = toOption(option)
          return entry.disabled ? { ...normalized, disabled: true } : normalized
        }),
      })
    } else {
      if (!loose) result.push((loose = { key: `loose-${index}`, options: [] }))
      loose.options.push(toOption(entry))
    }
  }
  return result
})

const query = ref('')
const filteredSections = computed<Section[]>(() => {
  const text = query.value.trim().toLowerCase()
  if (!props.filterable || !text) return sections.value
  const matches = (option: ListboxOption) =>
    labelOf(option).toLowerCase().includes(text) ||
    !!option.description?.toLowerCase().includes(text)
  return sections.value
    .map((section) => ({ ...section, options: section.options.filter(matches) }))
    .filter((section) => section.options.length > 0)
})
/** Every option shown, in order; `active` indexes into it. */
const flat = computed(() => filteredSections.value.flatMap((section) => section.options))
const indexes = computed(() => new Map(flat.value.map((option, index) => [option, index])))
const indexOf = (option: ListboxOption) => indexes.value.get(option)!

const selected = computed<ListboxValue[]>(() => {
  const value = model.value
  if (props.multiple) return Array.isArray(value) ? value : []
  return value === null || value === undefined || Array.isArray(value) ? [] : [value]
})
const isSelected = (option: ListboxOption) => selected.value.includes(option.value)

const active = ref(-1)
const listRef = useTemplateRef<HTMLElement>('list')
const inputRef = useTemplateRef<HTMLInputElement>('input')

watch(query, () => {
  active.value = flat.value.findIndex((option) => !option.disabled)
})

function scrollToActive() {
  nextTick(() => {
    const element = listRef.value?.querySelector<HTMLElement>(
      `#${CSS.escape(optionId(active.value))}`,
    )
    element?.scrollIntoView?.({ block: 'nearest' })
  })
}

function move(from: number, step: 1 | -1) {
  const list = flat.value
  for (let index = from + step; index >= 0 && index < list.length; index += step) {
    if (!list[index]!.disabled) {
      active.value = index
      scrollToActive()
      return
    }
  }
}

function choose(option: ListboxOption | undefined) {
  if (!option || option.disabled || disabled.value) return
  let next: ListboxValue | ListboxValue[] | null
  if (props.multiple) {
    next = isSelected(option)
      ? selected.value.filter((value) => value !== option.value)
      : [...selected.value, option.value]
  } else {
    next = option.value
    if (isSelected(option)) return
  }
  model.value = next
  emit('change', next)
  formItem?.trigger('change')
}

function onFocus() {
  if (active.value >= 0) return
  const first = flat.value.findIndex((option) => isSelected(option) && !option.disabled)
  active.value = first >= 0 ? first : flat.value.findIndex((option) => !option.disabled)
  scrollToActive()
}

// Typing on the list jumps to the next option starting with what was typed.
let typed = ''
let typedTimer: ReturnType<typeof setTimeout> | undefined
function typeahead(char: string) {
  clearTimeout(typedTimer)
  typed += char.toLowerCase()
  typedTimer = setTimeout(() => (typed = ''), 500)
  const list = flat.value
  // A repeated letter cycles through the options starting with it.
  const text = [...typed].every((c) => c === typed[0]) ? typed[0]! : typed
  const start = text.length === 1 ? active.value + 1 : Math.max(active.value, 0)
  for (let offset = 0; offset < list.length; offset++) {
    const index = (start + offset) % list.length
    const option = list[index]!
    if (!option.disabled && labelOf(option).toLowerCase().startsWith(text)) {
      active.value = index
      scrollToActive()
      return
    }
  }
}

function onKeydown(event: KeyboardEvent) {
  if (disabled.value || event.isComposing) return
  const fromInput = event.target === inputRef.value
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      move(active.value, 1)
      break
    case 'ArrowUp':
      event.preventDefault()
      move(active.value < 0 ? flat.value.length : active.value, -1)
      break
    case 'Home':
      if (fromInput) return
      event.preventDefault()
      move(-1, 1)
      break
    case 'End':
      if (fromInput) return
      event.preventDefault()
      move(flat.value.length, -1)
      break
    case 'Enter':
      event.preventDefault()
      choose(flat.value[active.value])
      break
    case ' ':
      if (fromInput) return
      event.preventDefault()
      choose(flat.value[active.value])
      break
    default:
      if (
        !fromInput &&
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        typeahead(event.key)
      }
  }
}

const listStyle = computed(() =>
  props.maxHeight === undefined
    ? undefined
    : {
        maxHeight: typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight,
      },
)

function focus() {
  ;(inputRef.value ?? listRef.value)?.focus()
}

defineExpose<ListboxExpose>({ focus })
</script>

<template>
  <div
    :class="[
      ns.b(),
      ns.m(size),
      ns.is('disabled', disabled),
      ns.is('multiple', multiple),
      ns.is('invalid', !!formItem?.invalid.value),
    ]"
  >
    <div v-if="filterable" :class="ns.e('search')">
      <SearchIcon :class="ns.e('search-icon')" />
      <input
        ref="input"
        v-model="query"
        :class="ns.e('input')"
        type="text"
        autocomplete="off"
        :placeholder="t('listbox.search')"
        :aria-label="t('listbox.search')"
        :aria-controls="`${id}-list`"
        :aria-activedescendant="active >= 0 ? optionId(active) : undefined"
        :disabled="disabled"
        @keydown="onKeydown"
        @focus="onFocus"
      />
    </div>
    <ul
      v-show="flat.length"
      :id="`${id}-list`"
      ref="list"
      role="listbox"
      :class="ns.e('list')"
      :style="listStyle"
      :tabindex="filterable || disabled ? -1 : 0"
      :aria-label="ariaLabel"
      :aria-labelledby="ariaLabel ? undefined : formItem?.labelId"
      :aria-describedby="formItem?.describedBy.value"
      :aria-multiselectable="multiple || undefined"
      :aria-disabled="disabled || undefined"
      :aria-activedescendant="!filterable && active >= 0 ? optionId(active) : undefined"
      @keydown="onKeydown"
      @focus="onFocus"
    >
      <li
        v-for="section in filteredSections"
        :key="section.key"
        role="presentation"
        :class="ns.e('section')"
      >
        <div
          v-if="section.label"
          :id="`${id}-${section.key}`"
          role="presentation"
          :class="ns.e('group-label')"
        >
          {{ section.label }}
        </div>
        <ul
          role="group"
          :class="ns.e('group')"
          :aria-labelledby="section.label ? `${id}-${section.key}` : undefined"
        >
          <li
            v-for="option in section.options"
            :id="optionId(indexOf(option))"
            :key="String(option.value)"
            role="option"
            :aria-selected="isSelected(option)"
            :aria-disabled="option.disabled || undefined"
            :class="[
              ns.e('option'),
              ns.is('active', indexOf(option) === active),
              ns.is('selected', isSelected(option)),
              ns.is('disabled', !!option.disabled),
            ]"
            @mousedown.prevent="!filterable && !disabled && listRef?.focus()"
            @mousemove="!option.disabled && (active = indexOf(option))"
            @click="choose(option)"
          >
            <slot name="option" :option="option" :selected="isSelected(option)">
              <component :is="option.icon" v-if="option.icon" :class="ns.e('icon')" />
              <span :class="ns.e('text')">
                <span :class="ns.e('label')">{{ labelOf(option) }}</span>
                <span v-if="option.description" :class="ns.e('description')">
                  {{ option.description }}
                </span>
              </span>
            </slot>
            <CheckIcon v-if="isSelected(option)" :class="ns.e('check')" />
          </li>
        </ul>
      </li>
    </ul>
    <div v-if="!flat.length" :class="ns.e('empty')">
      <slot name="empty">{{ t('listbox.empty') }}</slot>
    </div>
  </div>
</template>
