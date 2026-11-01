<script setup lang="ts">
import { DouButton, useFloating, useZIndex, type VirtualElement } from 'dou-ui'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import type { SheetNoteMessages } from '../locale'

/*
 * A cell's note, beside the cell: read when the pointer rests on the cell
 * or a finger taps it, or written in the box when it is being edited.
 */

const props = defineProps<{
  /** The cell the note belongs to. */
  anchor: VirtualElement
  note: string
  editing: boolean
  messages: SheetNoteMessages
}>()

const emit = defineEmits<{
  /** `leaving` when focus left the box for something else. */
  save: [note: string, leaving: boolean]
  cancel: [leaving: boolean]
  /** The pointer came onto the note, or left it. */
  hover: [inside: boolean]
}>()

const box = useTemplateRef<HTMLElement>('box')
const input = useTemplateRef<HTMLTextAreaElement>('input')
const draft = ref(props.note)

const { style, placement, update } = useFloating(() => props.anchor, box, {
  open: true,
  placement: 'right-start',
  offset: 6,
})
const zIndex = useZIndex().next()

/** Grows the box with the text, up to the height the styles allow. */
function fit() {
  const el = input.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
  void nextTick(update)
}

watch(
  () => props.editing,
  async (editing) => {
    draft.value = props.note
    if (!editing) return
    await nextTick()
    fit()
    const el = input.value
    el?.focus({ preventScroll: true })
    el?.setSelectionRange(el.value.length, el.value.length)
  },
  { immediate: true, flush: 'post' },
)

const changed = computed(() => draft.value !== props.note)
let done = false

function save(leaving = false) {
  if (done) return
  done = true
  emit('save', draft.value, leaving)
}

function cancel(leaving = false) {
  if (done) return
  done = true
  emit('cancel', leaving)
}

function onKeydown(event: KeyboardEvent) {
  // the grid's keys stay out of the box
  event.stopPropagation()
  if (event.isComposing) return
  if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
  } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    save()
  }
}

/** Focus leaving the box keeps what was written, as clicking another cell does. */
function onFocusout(event: FocusEvent) {
  const next = event.relatedTarget
  if (next instanceof Node && box.value?.contains(next)) return
  if (changed.value) save(true)
  else cancel(true)
}

defineExpose({ focus: () => input.value?.focus({ preventScroll: true }) })
</script>

<template>
  <Transition name="dou-floating" appear>
    <div
      ref="box"
      class="dou-dropdown dou-floating dou-sheet__note"
      :class="{ 'is-editing': editing }"
      :style="[style, { zIndex }]"
      :data-placement="placement"
      :role="editing ? 'dialog' : undefined"
      :aria-label="editing ? messages.label : undefined"
      @pointerenter="emit('hover', true)"
      @pointerleave="emit('hover', false)"
      @pointerdown.stop
      @focusout="editing && onFocusout($event)"
      @contextmenu.stop
      @wheel.stop
    >
      <template v-if="editing">
        <textarea
          ref="input"
          v-model="draft"
          class="dou-sheet__note-input"
          :aria-label="messages.label"
          :placeholder="messages.placeholder"
          rows="3"
          @input="fit"
          @keydown="onKeydown"
        />
        <!-- pressing a button leaves focus in the box, so it isn't taken as leaving -->
        <div class="dou-sheet__note-actions" @mousedown.prevent>
          <DouButton size="sm" variant="ghost" @keydown="onKeydown" @click="cancel()">
            {{ messages.cancel }}
          </DouButton>
          <DouButton size="sm" variant="solid" @keydown="onKeydown" @click="save()">
            {{ messages.save }}
          </DouButton>
        </div>
      </template>
      <p v-else class="dou-sheet__note-text">{{ note }}</p>
    </div>
  </Transition>
</template>
