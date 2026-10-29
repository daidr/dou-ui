<script setup lang="ts">
import { CheckIcon, ChevronDownIcon, CloseIcon } from '@dou-ui/icons'
import { computed, nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
import type { HTMLAttributes } from 'vue'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import DouSpinner from '../spinner/spinner.vue'
import { DouTag } from '../tag'
import type {
  SelectExpose,
  SelectOption,
  SelectOptionGroup,
  SelectProps,
  SelectSlots,
  SelectValue,
} from './select'
import { useTeleport } from '../../utils/teleport'

defineOptions({ name: 'DouSelect', inheritAttrs: false })

const props = withDefaults(defineProps<SelectProps>(), {
  multiple: false,
  filterable: false,
  disabled: false,
  invalid: false,
  clearable: false,
  placement: 'bottom-start',
  teleport: undefined,
  remote: false,
  searchDelay: 300,
  loading: false,
  creatable: false,
  virtual: false,
})
const teleportTarget = useTeleport(() => props.teleport)
const model = defineModel<SelectValue | SelectValue[] | null>()
const emit = defineEmits<{
  change: [value: SelectValue | SelectValue[] | null]
  clear: []
  search: [query: string]
  create: [value: string]
  visibleChange: [open: boolean]
  removeTag: [value: SelectValue]
}>()
const slots = defineSlots<SelectSlots>()

const ns = useNamespace('select')
const { t } = useLocale()
const { formItem } = useFormItem()
// Searching remotely or creating options needs the search box.
const filterable = computed(() => props.filterable || props.remote || props.creatable)
// A plain combobox is not labelable, so the item names it by id instead.
if (!filterable.value) formItem?.markGroup()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)

const id = `dou-select-${useId()}`
const listboxId = `${id}-listbox`
const optionId = (index: number) => `${id}-option-${index}`

const toOption = (option: SelectOption | string | number): SelectOption =>
  typeof option === 'object' ? option : { value: option, label: String(option) }
const isGroup = (
  entry: SelectOption | SelectOptionGroup | string | number,
): entry is SelectOptionGroup =>
  typeof entry === 'object' && Array.isArray((entry as SelectOptionGroup).options)

interface Section {
  key: string
  label?: string
  options: SelectOption[]
}

/** Options created from the search text, kept so they stay listed. */
const created = ref<SelectOption[]>([])

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
  const known = new Set(result.flatMap((section) => section.options.map((o) => o.value)))
  const extra = created.value.filter((option) => !known.has(option.value))
  if (extra.length) result.push({ key: 'created', options: extra })
  return result
})
const options = computed(() => sections.value.flatMap((section) => section.options))
const labelOf = (option: SelectOption) =>
  option.label ??
  (typeof option.value === 'object' ? String(identity(option.value)) : String(option.value))

/** What tells values apart: the `valueKey` of an object, otherwise the value itself. */
function identity(value: SelectValue): unknown {
  return props.valueKey && value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)[props.valueKey]
    : value
}
const same = (a: SelectValue | null | undefined, b: SelectValue | null | undefined) =>
  a === b || (a != null && b != null && identity(a) === identity(b))

// Remember every option seen, so a value chosen from earlier remote
// results keeps its label after the options change.
const seen = new Map<unknown, SelectOption>()
watch(
  options,
  (list) => {
    for (const option of list) seen.set(identity(option.value), option)
  },
  { immediate: true },
)

const selected = computed<SelectValue[]>(() => {
  const value = model.value
  if (props.multiple) return Array.isArray(value) ? value : []
  return value === null || value === undefined || Array.isArray(value) ? [] : [value]
})
const isSelected = (option: SelectOption) =>
  selected.value.some((value) => same(value, option.value))
const selectedOptions = computed(() =>
  selected.value.map(
    (value) =>
      options.value.find((option) => same(option.value, value)) ??
      seen.get(identity(value)) ?? { value },
  ),
)
const atLimit = computed(
  () => props.multiple && !!props.multipleLimit && selected.value.length >= props.multipleLimit,
)
/** Disabled, or out of reach because the limit is met. */
const unavailable = (option: SelectOption) =>
  !!option.disabled || (atLimit.value && !isSelected(option))

// tags shown in the field, and how many more fold into "+N"
const shownTags = computed(() =>
  props.maxTagCount === undefined
    ? selectedOptions.value
    : selectedOptions.value.slice(0, Math.max(0, props.maxTagCount)),
)
const hiddenTags = computed(() => selectedOptions.value.slice(shownTags.value.length))
const hasValue = computed(() => selected.value.length > 0)

const query = ref('')
const matches = (option: SelectOption, text: string) => labelOf(option).toLowerCase().includes(text)
const filteredSections = computed<Section[]>(() => {
  const text = query.value.trim().toLowerCase()
  if (!filterable.value || props.remote || !text) return sections.value
  return sections.value
    .map((section) => ({ ...section, options: section.options.filter((o) => matches(o, text)) }))
    .filter((section) => section.options.length > 0)
})

/** The pseudo-option that creates the typed text, when nothing matches it exactly. */
const createOption = computed<SelectOption | undefined>(() => {
  const text = query.value.trim()
  if (!props.creatable || !text) return undefined
  if (options.value.some((option) => labelOf(option) === text || same(option.value, text))) {
    return undefined
  }
  return { value: text, label: t('select.create', { query: text }) }
})

/** Every option the keyboard can reach, in list order. */
const filtered = computed<SelectOption[]>(() => [
  ...(createOption.value ? [createOption.value] : []),
  ...filteredSections.value.flatMap((section) => section.options),
])
const indexOf = (option: SelectOption) => filtered.value.indexOf(option)

// virtual list: every row (group label or option) is one option tall
const ROW = 32
type Row =
  | { kind: 'group'; key: string; label: string; id: string }
  | { kind: 'option'; key: string; option: SelectOption; index: number }
const rows = computed<Row[]>(() => {
  const result: Row[] = []
  if (createOption.value) {
    result.push({ kind: 'option', key: 'create', option: createOption.value, index: 0 })
  }
  for (const section of filteredSections.value) {
    if (section.label) {
      result.push({
        kind: 'group',
        key: section.key,
        label: section.label,
        id: `${id}-${section.key}`,
      })
    }
    for (const option of section.options) {
      result.push({
        kind: 'option',
        key: String(identity(option.value)),
        option,
        index: indexOf(option),
      })
    }
  }
  return result
})
const menuScroll = ref(0)
const virtualRange = computed(() => {
  const from = Math.max(0, Math.floor(menuScroll.value / ROW) - 4)
  return { from, to: Math.min(rows.value.length, from + Math.ceil(280 / ROW) + 8) }
})
const virtualRows = computed(() => rows.value.slice(virtualRange.value.from, virtualRange.value.to))

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
const enabled = (index: number) => !!filtered.value[index] && !unavailable(filtered.value[index]!)

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

// remote search: report the text once typing pauses, and on opening
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(query, (text) => {
  if (!props.remote || !open.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => emit('search', text), props.searchDelay)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

watch(open, (value) => {
  emit('visibleChange', value)
  if (!value) query.value = ''
  else if (props.remote) emit('search', query.value)
})
watch(filtered, () => {
  if (open.value) edge('first')
})
watch(active, async (index) => {
  await nextTick()
  const menu = panelRef.value
  if (!menu) return
  if (props.virtual) {
    // The option may not be rendered yet: scroll by its row instead.
    const row = rows.value.findIndex((item) => item.kind === 'option' && item.index === index)
    if (row < 0) return
    const inset = 4
    const top = row * ROW + inset
    const current = menuScroll.value
    let target = current
    if (top < current) target = top - inset
    else if (top + ROW > current + menu.clientHeight) target = top + ROW - menu.clientHeight + inset
    // Render the rows around the target now, before the scroll event arrives.
    menuScroll.value = Math.max(0, target)
    menu.scrollTop = menuScroll.value
    return
  }
  menu.querySelector(`#${CSS.escape(optionId(index))}`)?.scrollIntoView?.({ block: 'nearest' })
})

function commit(value: SelectValue | SelectValue[] | null) {
  model.value = value
  emit('change', value)
  formItem?.trigger('change')
}

function choose(option: SelectOption | undefined) {
  if (!option || unavailable(option)) return
  if (option === createOption.value) {
    const value = String(option.value)
    option = { value, label: value }
    created.value = [...created.value, option]
    seen.set(value, option)
    emit('create', value)
  }
  if (props.multiple) {
    const chosen = option
    const values = isSelected(chosen)
      ? selected.value.filter((value) => !same(value, chosen.value))
      : [...selected.value, chosen.value]
    commit(values)
    query.value = ''
  } else {
    if (!same(option.value, model.value as SelectValue | null | undefined)) commit(option.value)
    hide()
  }
}

function remove(value: SelectValue) {
  if (disabled.value) return
  commit(selected.value.filter((item) => !same(item, value)))
  emit('removeTag', value)
}

function clear() {
  commit(props.multiple ? [] : null)
  emit('clear')
  hide()
  focus()
}

const fieldRef = useTemplateRef<HTMLElement>('field')
const inputRef = useTemplateRef<HTMLInputElement>('input')
const combobox = () => (filterable.value ? inputRef.value : fieldRef.value)
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
      if (!open.value || filterable.value) return
      event.preventDefault()
      edge(event.key === 'Home' ? 'first' : 'last')
      return
    case 'Enter':
      event.preventDefault()
      if (open.value) choose(filtered.value[active.value])
      else show()
      return
    case ' ':
      if (filterable.value) return
      event.preventDefault()
      if (open.value) choose(filtered.value[active.value])
      else show()
      return
    case 'Tab':
      hide()
      return
    case 'Backspace':
      if (props.multiple && filterable.value && !query.value && selected.value.length) {
        remove(selected.value.at(-1)!)
      }
      return
  }

  // Without a search box, typing jumps to the next option starting with it.
  if (filterable.value || event.key.length !== 1 || event.ctrlKey || event.metaKey) return
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
  ns.is('filterable', filterable.value),
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
      v-bind="filterable ? $attrs : { ...$attrs, ...comboboxAttrs }"
      :class="classes"
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
          <template v-for="option in shownTags" :key="String(identity(option.value))">
            <slot name="tag" :option="option" :remove="() => remove(option.value)">
              <DouTag
                :size="tagSize"
                :closable="!disabled"
                :class="ns.e('tag')"
                @close="remove(option.value)"
              >
                {{ labelOf(option) }}
              </DouTag>
            </slot>
          </template>
          <DouTag
            v-if="hiddenTags.length"
            :size="tagSize"
            :class="[ns.e('tag'), ns.e('tag-more')]"
            :title="hiddenTags.map(labelOf).join('、')"
          >
            +{{ hiddenTags.length }}
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
        <span v-else-if="!multiple && hasValue" :class="ns.e('value')">
          <slot name="label" :option="selectedOptions[0]!">{{ singleLabel }}</slot>
        </span>
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
        <CloseIcon />
      </button>
      <ChevronDownIcon :class="ns.e('arrow')" />
    </div>
  </OnlyChild>
  <Teleport v-if="rendered" :to="teleportTarget.to" :disabled="teleportTarget.disabled">
    <Transition appear name="dou-floating">
      <div
        v-show="open"
        ref="panelRef"
        :class="[ns.e('menu'), 'dou-floating', ns.is('virtual', virtual)]"
        :style="panelStyle"
        :data-placement="placement"
        :data-dou-theme="theme"
        @mousedown.prevent
        @scroll="virtual && (menuScroll = ($event.target as HTMLElement).scrollTop)"
      >
        <div v-if="slots.header" :class="ns.e('header')"><slot name="header" /></div>
        <div v-if="loading" :class="ns.e('loading')" role="status">
          <DouSpinner size="sm" :label="t('select.loading')" />
          <span aria-hidden="true">{{ t('select.loading') }}</span>
        </div>
        <ul
          v-else-if="virtual"
          :id="listboxId"
          role="listbox"
          :class="ns.e('list')"
          :style="{ height: `${rows.length * ROW}px` }"
          :aria-multiselectable="multiple || undefined"
          :aria-labelledby="formItem?.labelId"
        >
          <template v-for="(row, offset) in virtualRows" :key="row.key">
            <li
              v-if="row.kind === 'group'"
              role="presentation"
              :class="ns.e('group-label')"
              :style="{ transform: `translateY(${(virtualRange.from + offset) * ROW}px)` }"
            >
              {{ row.label }}
            </li>
            <li
              v-else
              :id="optionId(row.index)"
              role="option"
              :aria-selected="isSelected(row.option)"
              :aria-disabled="unavailable(row.option) || undefined"
              :aria-setsize="filtered.length"
              :aria-posinset="row.index + 1"
              :class="[
                ns.e('option'),
                ns.is('active', row.index === active),
                ns.is('selected', isSelected(row.option)),
                ns.is('disabled', unavailable(row.option)),
                ns.is('create', row.option === createOption),
              ]"
              :style="{ transform: `translateY(${(virtualRange.from + offset) * ROW}px)` }"
              @click="choose(row.option)"
              @mousemove="!unavailable(row.option) && (active = row.index)"
            >
              <span :class="ns.e('option-label')">
                <slot name="option" :option="row.option" :selected="isSelected(row.option)">
                  {{ labelOf(row.option) }}
                </slot>
              </span>
              <CheckIcon v-if="isSelected(row.option)" :class="ns.e('check')" />
            </li>
          </template>
        </ul>
        <ul
          v-else
          :id="listboxId"
          role="listbox"
          :class="ns.e('list')"
          :aria-multiselectable="multiple || undefined"
          :aria-labelledby="formItem?.labelId"
        >
          <li
            v-if="createOption"
            :id="optionId(0)"
            role="option"
            :aria-selected="false"
            :class="[ns.e('option'), ns.is('active', active === 0), ns.is('create', true)]"
            @click="choose(createOption)"
            @mousemove="active = 0"
          >
            <span :class="ns.e('option-label')">{{ labelOf(createOption) }}</span>
          </li>
          <li
            v-for="section in filteredSections"
            :key="section.key"
            role="presentation"
            :class="ns.e('section')"
          >
            <div
              v-if="section.label"
              :id="`${id}-${section.key}`"
              :class="ns.e('group-label')"
              aria-hidden="true"
            >
              {{ section.label }}
            </div>
            <ul
              :role="section.label ? 'group' : 'presentation'"
              :aria-labelledby="section.label ? `${id}-${section.key}` : undefined"
              :class="ns.e('group')"
            >
              <li
                v-for="option in section.options"
                :id="optionId(indexOf(option))"
                :key="String(identity(option.value))"
                role="option"
                :aria-selected="isSelected(option)"
                :aria-disabled="unavailable(option) || undefined"
                :class="[
                  ns.e('option'),
                  ns.is('active', indexOf(option) === active),
                  ns.is('selected', isSelected(option)),
                  ns.is('disabled', unavailable(option)),
                ]"
                @click="choose(option)"
                @mousemove="!unavailable(option) && (active = indexOf(option))"
              >
                <span :class="ns.e('option-label')">
                  <slot name="option" :option="option" :selected="isSelected(option)">
                    {{ labelOf(option) }}
                  </slot>
                </span>
                <CheckIcon v-if="isSelected(option)" :class="ns.e('check')" />
              </li>
            </ul>
          </li>
        </ul>
        <div v-if="!loading && !filtered.length" :class="ns.e('empty')">
          <slot name="empty">{{ t('select.empty') }}</slot>
        </div>
        <div v-if="slots.footer" :class="ns.e('footer')"><slot name="footer" /></div>
      </div>
    </Transition>
  </Teleport>
</template>
