<script setup lang="ts">
import { DouAvatar, useFloating, useLayer, useZIndex, type VirtualElement } from 'dou-ui'
import { computed, nextTick, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { useEditorContext } from '../../editor'
import {
  chooseMention,
  closeMention,
  getMention,
  setMentionActive,
  setMentionItems,
  type MentionItem,
} from './state'

const props = defineProps<{
  search: (query: string) => MentionItem[] | Promise<MentionItem[]>
}>()

const { view, state, messages } = useEditorContext()
const id = `dou-editor-mention-${useId()}`
const panel = useTemplateRef<HTMLElement>('panel')

const mention = computed(() => getMention(state.value))
const open = computed(() => !!mention.value)
const loading = shallowRef(false)

// the list hangs below the `@` that opened it
const anchor: VirtualElement = {
  getBoundingClientRect() {
    const current = view.value
    const from = mention.value?.from
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
const { next } = useZIndex()
const zIndex = shallowRef(0)
watch(open, (value) => value && (zIndex.value = next()), { immediate: true })
// a press outside the editor and the list closes it; inside, the cursor move does
useLayer({
  open,
  elements: () => [panel.value, view.value?.dom],
  onOutside: () => view.value && closeMention(view.value),
  onEscape: () => view.value && closeMention(view.value),
})

// search again as the query changes; a slower, older answer never wins
let run = 0
watch(
  () => (mention.value ? mention.value.query : null),
  async (query) => {
    const current = ++run
    if (query === null) {
      loading.value = false
      return
    }
    loading.value = true
    let items: MentionItem[] = []
    try {
      items = await props.search(query)
    } catch {
      // a failed search shows nothing
    }
    if (current !== run || !view.value || !getMention(view.value.state)) return
    loading.value = false
    setMentionItems(view.value, items.slice(0, 50))
    void nextTick(update)
  },
  { immediate: true },
)

// the editor keeps focus; the active item is announced through it
watch(
  () => [open.value, mention.value?.active, mention.value?.items] as const,
  () => {
    const dom = view.value?.dom
    if (!dom) return
    const items = mention.value?.items ?? []
    const option = open.value && items.length ? `${id}-${mention.value!.active}` : null
    if (open.value) dom.setAttribute('aria-controls', id)
    else dom.removeAttribute('aria-controls')
    if (option) dom.setAttribute('aria-activedescendant', option)
    else dom.removeAttribute('aria-activedescendant')
    if (option) document.getElementById(option)?.scrollIntoView({ block: 'nearest' })
  },
  { flush: 'post' },
)

function choose(item: MentionItem) {
  if (view.value) chooseMention(view.value, item)
}

function hover(index: number) {
  if (view.value && mention.value?.active !== index) setMentionActive(view.value, index)
}
</script>

<template>
  <Transition name="dou-floating">
    <div
      v-if="open"
      :id="id"
      ref="panel"
      role="listbox"
      :aria-label="messages.mention.label"
      class="dou-dropdown dou-floating dou-editor-mention"
      :style="[style, { zIndex }]"
      :data-placement="placement"
      @mousedown.prevent
    >
      <div
        v-for="(item, index) in mention!.items"
        :id="`${id}-${index}`"
        :key="item.id"
        role="option"
        :aria-selected="index === mention!.active"
        :class="[
          'dou-dropdown__item',
          'dou-editor-mention__item',
          { 'is-active': index === mention!.active },
        ]"
        @pointermove="hover(index)"
        @click="choose(item)"
      >
        <DouAvatar :src="item.avatar" :name="item.label" size="sm" />
        <span class="dou-editor-mention__text">
          <span class="dou-editor-mention__label">{{ item.label }}</span>
          <span v-if="item.description" class="dou-editor-mention__description">{{
            item.description
          }}</span>
        </span>
      </div>
      <div v-if="!mention!.items.length" class="dou-editor-slash__empty">
        {{ loading ? messages.mention.searching : messages.mention.noResults }}
      </div>
    </div>
  </Transition>
</template>
