<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import { useFloating } from '../../composables/use-floating'
import { useLayer } from '../../composables/use-layer'
import { useThemeScope } from '../../composables/use-theme-scope'
import { useNamespace } from '../../utils/namespace'
import { useLocale, useZIndex } from '../config-provider/use-config'
import { DouSpinner } from '../spinner'
import { DouTextarea } from '../textarea'
import type { TextareaExpose } from '../textarea/textarea'
import { caretRect, findMention } from './caret'
import type { MentionExpose, MentionOption, MentionProps, MentionSlots } from './mention'

defineOptions({ name: 'DouMention', inheritAttrs: false })

const props = withDefaults(defineProps<MentionProps>(), {
  options: () => [],
  prefix: '@',
  split: ' ',
  filter: true,
  loading: false,
  rows: 3,
  autosize: false,
  disabled: false,
  readonly: false,
  invalid: false,
  teleport: 'body',
})
const model = defineModel<string>({ default: '' })
const emit = defineEmits<{
  search: [query: string, prefix: string]
  select: [option: MentionOption, prefix: string]
}>()
const slots = defineSlots<MentionSlots>()

const ns = useNamespace('mention')
const list = useNamespace('autocomplete')
const { t } = useLocale()
const listboxId = `dou-mention-${useId()}`
const optionId = (index: number) => `${listboxId}-${index}`

const textareaRef = useTemplateRef<TextareaExpose>('textarea')
const field = () => textareaRef.value?.textarea ?? null
const panelRef = ref<HTMLElement | null>(null)

/** The mention being typed: where its prefix starts and what follows it. */
const typing = ref<{ prefix: string; start: number; query: string } | null>(null)
const open = computed(() => !!typing.value && !props.disabled && !props.readonly)

const prefixes = computed(() => (Array.isArray(props.prefix) ? props.prefix : [props.prefix]))
const labelOf = (option: MentionOption) => option.label ?? option.value

const matches = computed(() => {
  const query = typing.value?.query ?? ''
  if (props.filter === false) return props.options
  const test =
    typeof props.filter === 'function'
      ? (option: MentionOption) =>
          (props.filter as (q: string, o: MentionOption) => boolean)(query, option)
      : (option: MentionOption) =>
          `${option.value} ${labelOf(option)}`.toLowerCase().includes(query.toLowerCase())
  return props.options.filter(test)
})

const active = ref(-1)
const enabled = (index: number) => !!matches.value[index] && !matches.value[index]!.disabled
watch(matches, () => {
  active.value = matches.value.findIndex((option) => !option.disabled)
})

// The list hangs off the caret, measured when the mention starts.
const caret = ref(new DOMRect())
const anchor = { getBoundingClientRect: () => caret.value }
const floating = useFloating(() => anchor, panelRef, {
  open,
  placement: 'bottom-start',
  offset: 4,
})

const rendered = ref(false)
const zIndex = ref<number>()
const { next } = useZIndex()
const { theme, sync } = useThemeScope(field)
watch(open, (value) => {
  if (!value) return
  rendered.value = true
  zIndex.value = next()
  sync()
})

function detect() {
  const el = field()
  if (!el || document.activeElement !== el || el.selectionStart !== el.selectionEnd) {
    typing.value = null
    return
  }
  const found = findMention(el.value, el.selectionStart, prefixes.value)
  const before = typing.value
  typing.value = found
  if (!found) return
  if (!before || before.start !== found.start) {
    caret.value = caretRect(el, found.start)
    void nextTick(floating.update)
  }
  if (!before || before.query !== found.query || before.start !== found.start) {
    emit('search', found.query, found.prefix)
  }
}

// The bound value comes back on the next render; read the caret after it.
function onInput() {
  void nextTick(detect)
}

function close() {
  typing.value = null
}

function choose(option: MentionOption | undefined) {
  const current = typing.value
  const el = field()
  if (!option || option.disabled || !current || !el) return
  const end = current.start + current.prefix.length + current.query.length
  const inserted = `${current.prefix}${option.value}${props.split}`
  model.value = `${model.value.slice(0, current.start)}${inserted}${model.value.slice(end)}`
  emit('select', option, current.prefix)
  typing.value = null
  const position = current.start + inserted.length
  void nextTick(() => {
    el.focus()
    el.setSelectionRange(position, position)
  })
}

function move(direction: 1 | -1) {
  const count = matches.value.length
  if (!count) return
  for (let step = 1; step <= count; step++) {
    const index = (active.value + direction * step + count * 2) % count
    if (enabled(index)) {
      active.value = index
      panelRef.value
        ?.querySelector(`#${CSS.escape(optionId(index))}`)
        ?.scrollIntoView({ block: 'nearest' })
      return
    }
  }
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value || event.isComposing) return
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      event.preventDefault()
      move(event.key === 'ArrowDown' ? 1 : -1)
      return
    case 'Enter':
    case 'Tab':
      if (active.value >= 0 && matches.value.length) {
        event.preventDefault()
        choose(matches.value[active.value])
      }
      return
    case 'Escape':
      event.preventDefault()
      event.stopPropagation()
      close()
  }
}

// Caret moves by clicks and arrows are only known once they happened.
function onKeyup(event: KeyboardEvent) {
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) detect()
}

useLayer({
  open,
  elements: () => [field(), panelRef.value],
  onOutside: close,
})

const textareaAttrs = computed(() => ({
  'aria-autocomplete': 'list' as const,
  'aria-haspopup': 'listbox' as const,
  'aria-expanded': open.value,
  'aria-controls': rendered.value ? listboxId : undefined,
  'aria-activedescendant': open.value && active.value >= 0 ? optionId(active.value) : undefined,
}))

const panelStyle = computed(() => ({ ...floating.style.value, zIndex: zIndex.value }))

/** The label split around the first match of the query. */
function parts(option: MentionOption) {
  const label = labelOf(option)
  const query = typing.value?.query ?? ''
  const at = query ? label.toLowerCase().indexOf(query.toLowerCase()) : -1
  if (at < 0) return [{ text: label, match: false }]
  return [
    { text: label.slice(0, at), match: false },
    { text: label.slice(at, at + query.length), match: true },
    { text: label.slice(at + query.length), match: false },
  ].filter((part) => part.text)
}

defineExpose<MentionExpose>({
  focus: () => textareaRef.value?.focus(),
  blur: () => textareaRef.value?.blur(),
})
</script>

<template>
  <DouTextarea
    ref="textarea"
    v-model="model"
    v-bind="{ ...$attrs, ...textareaAttrs }"
    :class="ns.b()"
    :size="size"
    :rows="rows"
    :autosize="autosize"
    :disabled="disabled"
    :readonly="readonly"
    :invalid="invalid"
    :placeholder="placeholder"
    @input="onInput"
    @click="detect"
    @keydown="onKeydown"
    @keyup="onKeyup"
    @blur="close"
  />
  <Teleport v-if="rendered" :to="teleport || 'body'" :disabled="teleport === false">
    <Transition name="dou-floating">
      <div
        v-show="open"
        ref="panelRef"
        :class="[list.e('menu'), ns.e('menu'), 'dou-floating']"
        :style="panelStyle"
        :data-placement="floating.placement.value"
        :data-dou-theme="theme"
        @mousedown.prevent
      >
        <ul
          v-if="matches.length"
          :id="listboxId"
          role="listbox"
          :class="list.e('list')"
          :aria-busy="loading || undefined"
        >
          <li
            v-for="(option, index) in matches"
            :id="optionId(index)"
            :key="option.value"
            role="option"
            :aria-selected="index === active"
            :aria-disabled="option.disabled || undefined"
            :class="[
              list.e('option'),
              ns.is('active', index === active),
              ns.is('disabled', !!option.disabled),
            ]"
            @click="choose(option)"
            @mousemove="!option.disabled && (active = index)"
          >
            <slot name="option" :option="option" :query="typing?.query ?? ''">
              <span :class="list.e('label')">
                <template v-for="(part, i) in parts(option)" :key="i">
                  <mark v-if="part.match" :class="list.e('match')">{{ part.text }}</mark>
                  <template v-else>{{ part.text }}</template>
                </template>
              </span>
              <span v-if="option.description" :class="list.e('description')">
                {{ option.description }}
              </span>
            </slot>
          </li>
        </ul>
        <div v-else-if="loading" :class="list.e('status')" role="status">
          <DouSpinner size="sm" />
          {{ t('autocomplete.loading') }}
        </div>
        <div v-else :class="list.e('status')">
          <slot name="empty">{{ t('select.empty') }}</slot>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
