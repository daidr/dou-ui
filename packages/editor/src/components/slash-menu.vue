<script setup lang="ts">
import { ChevronRightIcon } from '@dou-ui/icons'
import { isComposing, useFloating, useLayer, useZIndex, type VirtualElement } from 'dou-ui'
import { computed, inject, nextTick, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { filterOptions } from '../catalog'
import { labelOf, type BlockOption } from '../core/extension'
import { insertBlockAfter, setBlockType } from '../core/commands'
import { slashKey, type SlashState } from '../core/slash'
import { editorKey } from '../editor'

const props = defineProps<{ slash: SlashState | null }>()

const { view, messages, kit } = inject(editorKey)!
const id = `dou-editor-slash-${useId()}`
const panel = useTemplateRef<HTMLElement>('panel')
const choicePanel = useTemplateRef<HTMLElement>('choicePanel')
const active = shallowRef(0)
/** The highlighted variant of the active option, when it has some (e.g. how many columns). */
const choice = shallowRef(0)

const options = computed(() =>
  props.slash ? filterOptions(kit.blockOptions, props.slash.query, messages.value) : [],
)
const open = computed(() => !!props.slash)
const activeOption = computed(() => options.value[active.value])
const choices = computed(() => (open.value ? activeOption.value?.choices : undefined))
watch(activeOption, () => (choice.value = 0))

// the menu hangs below the `/` that opened it
const anchor: VirtualElement = {
  getBoundingClientRect() {
    const current = view.value
    const from = props.slash?.from
    if (!current || from === undefined) return new DOMRect()
    const { left, top, bottom } = current.coordsAtPos(from)
    return new DOMRect(left, top, 0, bottom - top)
  },
}
const { style, placement, update } = useFloating(() => (open.value ? anchor : null), panel, {
  open,
  placement: 'bottom-start',
  offset: 6,
})
// the variants of the active option, in a panel beside it
const activeItem = () => (choices.value ? document.getElementById(`${id}-${active.value}`) : null)
const {
  style: choiceStyle,
  placement: choicePlacement,
  update: updateChoices,
} = useFloating(activeItem, choicePanel, {
  open: () => !!choices.value,
  placement: 'right-start',
  offset: 4,
})
watch([choices, active], () => void nextTick(updateChoices), { flush: 'post' })

// stacked like DouUI's own popups, above whatever opened before
const { next } = useZIndex()
const zIndex = shallowRef(0)
watch(open, (value) => value && (zIndex.value = next()), { immediate: true })
// a press outside the editor and the menu closes it; inside, the cursor move does
useLayer({
  open,
  elements: () => [panel.value, choicePanel.value, view.value?.dom],
  onOutside: () => close(),
  onEscape: () => close(),
})

watch(
  () => props.slash?.query,
  () => {
    active.value = 0
    void nextTick(update)
  },
)

// the editor keeps focus; the active option is announced through it
watch(
  [open, active, options, choice],
  () => {
    const dom = view.value?.dom
    if (!dom) return
    const option =
      open.value && options.value.length
        ? choices.value
          ? `${id}-choice-${choice.value}`
          : `${id}-${active.value}`
        : null
    if (open.value) {
      dom.setAttribute('aria-controls', id)
      dom.setAttribute('aria-expanded', 'true')
    } else {
      dom.removeAttribute('aria-controls')
      dom.removeAttribute('aria-expanded')
    }
    if (option) dom.setAttribute('aria-activedescendant', option)
    else dom.removeAttribute('aria-activedescendant')
    if (option) document.getElementById(option)?.scrollIntoView({ block: 'nearest' })
  },
  { flush: 'post' },
)

/** On a touch screen, the first tap on an option with variants only shows them. */
let touched = false
const onItemPointer = (event: PointerEvent) => (touched = event.pointerType !== 'mouse')

function onItemClick(option: BlockOption, index: number) {
  if (option.choices && touched && active.value !== index) {
    active.value = index
    return
  }
  choose(option)
}

function choose(option: BlockOption, variant = option.choices ? choice.value : -1) {
  const current = view.value
  const slash = props.slash
  if (!current || !slash) return
  const chosen = { ...option.props, ...option.choices?.items[variant]?.props }
  // remove the `/query`, then turn the block, or add one below when it has text
  const removed = current.state.tr.delete(slash.from, current.state.selection.from)
  current.dispatch(removed.setMeta(slashKey, null))
  const { $from } = current.state.selection
  if ($from.parent.content.size > 0) insertBlockAfter($from.pos)(current.state, current.dispatch)
  if (option.type !== 'paragraph' || $from.parent.content.size === 0)
    setBlockType(option.type, chosen)(current.state, current.dispatch)
  current.focus()
}

function close() {
  const current = view.value
  if (current) current.dispatch(current.state.tr.setMeta(slashKey, null))
}

/** Keys the editor passes on while the menu is open. */
function onKey(event: KeyboardEvent): boolean {
  if (isComposing(event)) return false
  const count = options.value.length
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      if (!count) return false
      active.value = (active.value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
      return true
    case 'ArrowRight':
    case 'ArrowLeft': {
      const items = choices.value?.items
      if (!items) return false
      const step = event.key === 'ArrowRight' ? 1 : -1
      choice.value = Math.min(items.length - 1, Math.max(0, choice.value + step))
      return true
    }
    case 'Enter':
    case 'Tab': {
      const option = options.value[active.value]
      if (!option) {
        close()
        return false
      }
      choose(option)
      return true
    }
    default:
      return false
  }
}

defineExpose({ onKey })
</script>

<template>
  <Transition name="dou-floating">
    <div
      v-if="open"
      :id="id"
      ref="panel"
      role="listbox"
      :aria-label="messages.blockTypes"
      class="dou-dropdown dou-floating dou-editor-slash"
      :style="[style, { zIndex }]"
      :data-placement="placement"
      @mousedown.prevent
    >
      <div
        v-for="(option, index) in options"
        :id="`${id}-${index}`"
        :key="option.key"
        role="option"
        :aria-selected="index === active"
        :class="['dou-dropdown__item', 'dou-editor-slash__item', { 'is-active': index === active }]"
        @pointerdown="onItemPointer"
        @pointermove="$event.pointerType !== 'touch' && (active = index)"
        @click="onItemClick(option, index)"
      >
        <span class="dou-editor-slash__icon"><component :is="option.icon" /></span>
        <span class="dou-editor-slash__text">
          <span class="dou-editor-slash__label">{{ labelOf(option.label, messages) }}</span>
          <span v-if="option.hint" class="dou-editor-slash__hint">{{
            labelOf(option.hint, messages)
          }}</span>
        </span>
        <kbd v-if="option.shortcut" class="dou-editor-slash__shortcut">{{ option.shortcut }}</kbd>
        <ChevronRightIcon v-if="option.choices" class="dou-editor-slash__more" aria-hidden="true" />
      </div>
      <div v-if="!options.length" class="dou-editor-slash__empty">{{ messages.noResults }}</div>
    </div>
  </Transition>
  <div
    v-if="choices && activeOption"
    ref="choicePanel"
    class="dou-dropdown dou-floating dou-editor-slash__choices"
    :style="[choiceStyle, { zIndex }]"
    :data-placement="choicePlacement"
    @mousedown.prevent
  >
    <div class="dou-editor-slash__choices-title">{{ labelOf(choices.title, messages) }}</div>
    <component
      :is="choices.component"
      v-if="choices.component"
      :id-prefix="`${id}-choice`"
      :items="choices.items"
      :active="choice"
      :messages="messages"
      @hover="choice = $event"
      @choose="choose(activeOption!, $event)"
    />
    <template v-else>
      <div
        v-for="(item, index) in choices.items"
        :id="`${id}-choice-${index}`"
        :key="index"
        role="option"
        :aria-selected="index === choice"
        :class="['dou-dropdown__item', { 'is-active': index === choice }]"
        @pointermove="choice = index"
        @click="choose(activeOption!, index)"
      >
        {{ labelOf(item.label, messages) }}
      </div>
    </template>
  </div>
</template>
