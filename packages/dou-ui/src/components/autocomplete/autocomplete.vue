<script setup lang="ts">
import { isComposing } from '../../utils/keyboard'
import { computed, nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
import { usePopup } from '../../composables/use-popup'
import { splitHighlight } from '../../utils/highlight'
import { useNamespace } from '../../utils/namespace'
import { shouldVirtualize, visibleWindow } from '../../utils/virtual'
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
import { useTeleport } from '../../utils/teleport'

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
  teleport: undefined,
  virtual: undefined,
})
const teleportTarget = useTeleport(() => props.teleport)
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
// A parent that re-renders passes a new but equal list: only a different
// list of suggestions clears the highlight.
const suggestionsKey = computed(() =>
  suggestions.value.map((option) => option.value).join('\u0000'),
)
watch(suggestionsKey, () => (active.value = -1))
// Long lists render only the suggestions in view, with spacers for the rest.
const ROW = 32
const INSET = 4
const menuScroll = ref(0)
const isVirtual = computed(() => shouldVirtualize(props.virtual, suggestions.value.length))
const view = computed(() => {
  const list = suggestions.value
  if (!isVirtual.value) return { from: 0, rows: list, before: 0, after: 0 }
  const { from, to } = visibleWindow(list.length, Math.max(0, menuScroll.value - INSET), 280, ROW)
  return { from, rows: list.slice(from, to), before: from * ROW, after: (list.length - to) * ROW }
})
function onMenuScroll(event: Event) {
  if (isVirtual.value) menuScroll.value = (event.target as HTMLElement).scrollTop
}

watch(active, async (index) => {
  await nextTick()
  const menu = panelRef.value
  if (!menu) return
  if (isVirtual.value) {
    if (index < 0) return
    // The option may not be rendered: scroll by its row instead.
    const top = index * ROW + INSET
    let target = menu.scrollTop
    if (top < target) target = top - INSET
    else if (top + ROW > target + menu.clientHeight) target = top + ROW - menu.clientHeight + INSET
    menu.scrollTop = Math.max(0, target)
    menuScroll.value = menu.scrollTop
    return
  }
  menu.querySelector(`#${CSS.escape(optionId(index))}`)?.scrollIntoView?.({ block: 'nearest' })
})
watch(suggestionsKey, () => {
  if (panelRef.value) panelRef.value.scrollTop = 0
  menuScroll.value = 0
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
  if (disabled.value || isComposing(event)) return
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

/** The label split around the matches of the text. */
const parts = (option: AutocompleteOption) =>
  splitHighlight(labelOf(option), props.highlight ? model.value : '')

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
  <Teleport v-if="rendered" :to="teleportTarget.to" :disabled="teleportTarget.disabled">
    <Transition appear name="dou-floating">
      <div
        v-show="open"
        ref="panelRef"
        :class="[ns.e('menu'), 'dou-floating']"
        :style="panelStyle"
        :data-placement="placement"
        :data-dou-theme="theme"
        @mousedown.prevent
        @scroll="onMenuScroll"
      >
        <ul :id="listboxId" role="listbox" :class="ns.e('list')" :aria-busy="loading || undefined">
          <li v-if="view.before" role="presentation" :style="{ height: `${view.before}px` }" />
          <li
            v-for="(option, offset) in view.rows"
            :id="optionId(view.from + offset)"
            :key="option.value"
            role="option"
            :aria-selected="view.from + offset === active"
            :aria-setsize="isVirtual ? suggestions.length : undefined"
            :aria-posinset="isVirtual ? view.from + offset + 1 : undefined"
            :aria-disabled="option.disabled || undefined"
            :class="[
              ns.e('option'),
              ns.is('active', view.from + offset === active),
              ns.is('disabled', !!option.disabled),
            ]"
            @click="choose(option)"
            @mousemove="!option.disabled && (active = view.from + offset)"
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
          <li v-if="view.after" role="presentation" :style="{ height: `${view.after}px` }" />
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
