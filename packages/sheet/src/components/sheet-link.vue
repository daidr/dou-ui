<script setup lang="ts">
import {
  DouButton,
  DouInput,
  DouTooltip,
  useFloating,
  useZIndex,
  type VirtualElement,
} from 'dou-ui'
import { LinkIcon, PencilIcon, UnlinkIcon } from '@dou-ui/icons'
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import { linkTarget } from '../core/link'
import type { SheetLinkMessages } from '../locale'

/*
 * A cell's link, under the cell: where it goes, with buttons to open it,
 * change it and take it off; or, while it is being edited, the text and
 * address to write.
 */

const props = defineProps<{
  /** The cell the link belongs to. */
  anchor: VirtualElement
  link: string
  /** What the cell shows; `null` for a formula's cell, whose text isn't edited here. */
  text: string | null
  editing: boolean
  /** Whether the link can be changed: the grid is editable and the cell isn't locked. */
  editable: boolean
  /** Whether the cell has a link of its own to take off, not only a formula's. */
  removable: boolean
  messages: SheetLinkMessages
}>()

const emit = defineEmits<{
  /** Follows the link: opens a web address, or goes to the cells. */
  open: []
  edit: []
  remove: []
  /** `leaving` when focus left the box for something else. */
  save: [link: string, text: string | null, leaving: boolean]
  cancel: [leaving: boolean]
}>()

const box = useTemplateRef<HTMLElement>('box')
type Focusable = { focus: () => void; select: () => void }
const textInput = useTemplateRef<Focusable>('textInput')
const addressInput = useTemplateRef<Focusable>('addressInput')
const address = ref(props.link)
const text = ref(props.text ?? '')
const tried = ref(false)
const id = useId()

const { style, placement } = useFloating(() => props.anchor, box, {
  open: true,
  placement: 'bottom-start',
  offset: 6,
})
const zIndex = useZIndex().next()

const target = computed(() => linkTarget(props.link))
const href = computed(() => (target.value?.kind === 'web' ? target.value.href : undefined))
/** The address as shown: a web address without its scheme's slashes. */
const shown = computed(() => props.link.replace(/^https?:\/\//i, '').replace(/\/$/, ''))
const bad = computed(() => !!address.value.trim() && !linkTarget(address.value))

watch(
  () => props.editing,
  async (editing) => {
    address.value = props.link
    text.value = props.text ?? ''
    tried.value = false
    if (!editing) return
    await nextTick()
    const first = textInput.value ?? addressInput.value
    first?.focus()
    first?.select()
  },
  { immediate: true, flush: 'post' },
)

const changed = computed(
  () => address.value !== props.link || (props.text !== null && text.value !== props.text),
)
let done = false

function save(leaving = false) {
  if (done) return
  if (bad.value) {
    tried.value = true
    if (leaving) cancel(true)
    return
  }
  done = true
  emit('save', address.value.trim(), props.text === null ? null : text.value, leaving)
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
  } else if (event.key === 'Enter') {
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

/** A web address opens as any link does; a place in the workbook is gone to. */
function onOpen(event: MouseEvent) {
  if (href.value && !event.defaultPrevented) return
  event.preventDefault()
  emit('open')
}
</script>

<template>
  <Transition name="dou-floating" appear>
    <div
      ref="box"
      class="dou-dropdown dou-floating dou-sheet__link"
      :class="{ 'is-editing': editing }"
      :style="[style, { zIndex }]"
      :data-placement="placement"
      :role="editing ? 'dialog' : undefined"
      :aria-label="editing ? messages.label : undefined"
      @pointerdown.stop
      @focusout="editing && onFocusout($event)"
      @keydown="editing && onKeydown($event)"
      @contextmenu.stop
      @wheel.stop
    >
      <form v-if="editing" class="dou-sheet__link-form" @submit.prevent="save()">
        <label v-if="props.text !== null" class="dou-sheet__link-field">
          <span class="dou-sheet__link-label">{{ messages.text }}</span>
          <DouInput ref="textInput" v-model="text" size="sm" />
        </label>
        <label class="dou-sheet__link-field">
          <span class="dou-sheet__link-label">{{ messages.address }}</span>
          <DouInput
            ref="addressInput"
            v-model="address"
            size="sm"
            type="url"
            :placeholder="messages.addressPlaceholder"
            :invalid="tried && bad"
            :aria-describedby="tried && bad ? `${id}-bad` : undefined"
          />
        </label>
        <p v-if="tried && bad" :id="`${id}-bad`" class="dou-sheet__link-problem">
          {{ messages.badAddress }}
        </p>
        <!-- pressing a button leaves focus in the box, so it isn't taken as leaving -->
        <div class="dou-sheet__link-actions" @mousedown.prevent>
          <DouButton size="sm" variant="ghost" @click="cancel()">{{ messages.cancel }}</DouButton>
          <DouButton size="sm" variant="solid" native-type="submit">{{ messages.save }}</DouButton>
        </div>
      </form>
      <template v-else>
        <span class="dou-sheet__link-icon" aria-hidden="true"><LinkIcon /></span>
        <a
          class="dou-sheet__link-address"
          :href="href ?? '#'"
          :target="href ? '_blank' : undefined"
          :rel="href ? 'noopener noreferrer' : undefined"
          :title="`${messages.open}: ${link}`"
          @click="onOpen"
        >
          {{ shown }}
        </a>
        <div v-if="editable" class="dou-sheet__link-buttons">
          <DouTooltip :content="messages.edit" placement="top">
            <DouButton size="sm" variant="ghost" :aria-label="messages.edit" @click="emit('edit')">
              <PencilIcon />
            </DouButton>
          </DouTooltip>
          <DouTooltip v-if="removable" :content="messages.remove" placement="top">
            <DouButton
              size="sm"
              variant="ghost"
              :aria-label="messages.remove"
              @click="emit('remove')"
            >
              <UnlinkIcon />
            </DouButton>
          </DouTooltip>
        </div>
      </template>
    </div>
  </Transition>
</template>
