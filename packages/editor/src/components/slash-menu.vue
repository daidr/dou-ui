<script setup lang="ts">
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
const active = shallowRef(0)

const options = computed(() =>
  props.slash ? filterOptions(kit.blockOptions, props.slash.query, messages.value) : [],
)
const open = computed(() => !!props.slash)

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
// stacked like DouUI's own popups, above whatever opened before
const { next } = useZIndex()
const zIndex = shallowRef(0)
watch(open, (value) => value && (zIndex.value = next()), { immediate: true })
// a press outside the editor and the menu closes it; inside, the cursor move does
useLayer({
  open,
  elements: () => [panel.value, view.value?.dom],
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
  [open, active, options],
  () => {
    const dom = view.value?.dom
    if (!dom) return
    const option = open.value && options.value.length ? `${id}-${active.value}` : null
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

function choose(option: BlockOption) {
  const current = view.value
  const slash = props.slash
  if (!current || !slash) return
  // remove the `/query`, then turn the block, or add one below when it has text
  const removed = current.state.tr.delete(slash.from, current.state.selection.from)
  current.dispatch(removed.setMeta(slashKey, null))
  const { $from } = current.state.selection
  if ($from.parent.content.size > 0) insertBlockAfter($from.pos)(current.state, current.dispatch)
  if (option.type !== 'paragraph' || $from.parent.content.size === 0)
    setBlockType(option.type, option.props)(current.state, current.dispatch)
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
        @pointermove="active = index"
        @click="choose(option)"
      >
        <span class="dou-editor-slash__icon"><component :is="option.icon" /></span>
        <span class="dou-editor-slash__text">
          <span class="dou-editor-slash__label">{{ labelOf(option.label, messages) }}</span>
          <span v-if="option.hint" class="dou-editor-slash__hint">{{
            labelOf(option.hint, messages)
          }}</span>
        </span>
        <kbd v-if="option.shortcut" class="dou-editor-slash__shortcut">{{ option.shortcut }}</kbd>
      </div>
      <div v-if="!options.length" class="dou-editor-slash__empty">{{ messages.noResults }}</div>
    </div>
  </Transition>
</template>
