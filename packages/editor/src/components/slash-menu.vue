<script setup lang="ts">
import { ChevronRightIcon } from '@dou-ui/icons'
import { isComposing, useFloating, useLayer, useZIndex, type VirtualElement } from 'dou-ui'
import { computed, inject, nextTick, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { filterOptions } from '../catalog'
import { labelOf, type BlockOption } from '../core/extension'
import SlashChoices from './slash-choices.vue'
import { insertBlockAfter, setBlockType } from '../core/commands'
import { slashKey, type SlashState } from '../core/slash'
import { editorKey } from '../editor'

const props = defineProps<{ slash: SlashState | null }>()

const { view, state, messages, kit } = inject(editorKey)!
const id = `dou-editor-slash-${useId()}`
const panel = useTemplateRef<HTMLElement>('panel')
const choicePanel = useTemplateRef<HTMLElement>('choicePanel')
const active = shallowRef(0)
/**
 * The highlighted variant of the active option, when it has some (e.g. how
 * many columns); -1 while the option itself is highlighted, which inserts
 * the first variant.
 */
const choice = shallowRef(-1)
/**
 * With a coarse pointer (a phone), the variants unfold in the menu under
 * their option, once it is tapped, instead of in a panel beside it that
 * would cover the menu on a narrow screen. Read when the menu opens.
 */
const coarse = shallowRef(false)
/** The option whose variants are unfolded in the menu, or -1. */
const unfolded = shallowRef(-1)

const options = computed(() => {
  if (!props.slash) return []
  const current = state.value
  // only what can go here, e.g. no columns in a column
  const usable = current
    ? kit.blockOptions.filter((option) => setBlockType(option.type, option.props)(current))
    : kit.blockOptions
  return filterOptions(usable, props.slash.query, messages.value)
})
const open = computed(() => !!props.slash)
const activeOption = computed(() => options.value[active.value])
const activeChoices = computed(() => (open.value ? activeOption.value?.choices : undefined))
/** The variants in the panel beside the menu. */
const choices = computed(() => (coarse.value ? undefined : activeChoices.value))
/** The variants unfolded in the menu, or shown beside it: where the keys pick from. */
const shownChoices = computed(() =>
  coarse.value
    ? unfolded.value === active.value
      ? activeChoices.value
      : undefined
    : choices.value,
)
watch(activeOption, () => {
  choice.value = -1
  unfolded.value = -1
})
watch(open, (value) => {
  if (value) coarse.value = window.matchMedia?.('(pointer: coarse)').matches ?? false
})

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

// the editor keeps focus; the active option, or variant, is announced through it
watch(
  [open, active, options, choice, shownChoices],
  () => {
    const dom = view.value?.dom
    if (!dom) return
    const option =
      open.value && options.value.length
        ? shownChoices.value && choice.value >= 0
          ? `${id}-choice-${choice.value}`
          : `${id}-${active.value}`
        : null
    if (open.value) {
      dom.setAttribute('aria-controls', choices.value ? `${id} ${id}-choices` : id)
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

function onItemMove(event: PointerEvent, index: number) {
  if (event.pointerType === 'touch') return
  active.value = index
  // back on the option: clicking it inserts the first variant again
  choice.value = -1
}

function onItemClick(option: BlockOption, index: number) {
  if (option.choices && (coarse.value || touched) && unfolded.value !== index) {
    active.value = index
    unfolded.value = index
    return
  }
  choose(option)
}

function choose(option: BlockOption, variant = option.choices ? Math.max(0, choice.value) : -1) {
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
    case 'ArrowRight': {
      const items = activeChoices.value?.items
      if (!items) return false
      if (coarse.value && unfolded.value !== active.value) unfolded.value = active.value
      // past the last variant the key moves the cursor again
      else if (choice.value >= items.length - 1) return false
      choice.value++
      return true
    }
    case 'ArrowLeft':
      // from the first variant back to the option; on the option the key moves the cursor
      if (!activeChoices.value || choice.value < 0) return false
      choice.value--
      return true
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
      <template v-for="(option, index) in options" :key="option.key">
        <div
          :id="`${id}-${index}`"
          role="option"
          :aria-selected="index === active"
          :class="[
            'dou-dropdown__item',
            'dou-editor-slash__item',
            { 'is-active': index === active },
          ]"
          @pointerdown="onItemPointer"
          @pointermove="onItemMove($event, index)"
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
          <ChevronRightIcon
            v-if="option.choices"
            :class="['dou-editor-slash__more', { 'is-unfolded': coarse && unfolded === index }]"
            aria-hidden="true"
          />
        </div>
        <!-- on a phone: the variants under their option -->
        <div
          v-if="option.choices && coarse && unfolded === index"
          role="group"
          :aria-label="labelOf(option.choices.title, messages)"
          class="dou-editor-slash__unfolded"
        >
          <SlashChoices
            :choices="option.choices"
            :active="choice"
            :messages="messages"
            :id-prefix="`${id}-choice`"
            @hover="choice = $event"
            @choose="choose(option, $event)"
          />
        </div>
      </template>
      <div v-if="!options.length" class="dou-editor-slash__empty">{{ messages.noResults }}</div>
    </div>
  </Transition>
  <Transition name="dou-floating">
    <div
      v-if="choices && activeOption"
      :id="`${id}-choices`"
      ref="choicePanel"
      role="listbox"
      :aria-label="labelOf(choices.title, messages)"
      class="dou-dropdown dou-floating dou-editor-slash__choices"
      :style="[choiceStyle, { zIndex }]"
      :data-placement="choicePlacement"
      @mousedown.prevent
    >
      <SlashChoices
        :choices="choices"
        :active="choice"
        :messages="messages"
        :id-prefix="`${id}-choice`"
        @hover="choice = $event"
        @choose="choose(activeOption!, $event)"
      />
    </div>
  </Transition>
</template>
