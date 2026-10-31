<script setup lang="ts">
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CloseIcon,
  LetterCaseIcon,
  RegexIcon,
  ReplaceAllIcon,
  ReplaceIcon,
  WholeWordIcon,
} from '@dou-ui/icons'
import { DouButton, DouToggle, isComposing, isApplePlatform, useNamespace } from 'dou-ui'
import { computed, nextTick, ref } from 'vue'
import type { CodeSearchQuery } from './core/search'
import { type CodeMessages, format } from './locale'

defineOptions({ name: 'DouCodeSearchPanel' })

const props = defineProps<{
  messages: CodeMessages
  /** Matches found, and which one the selection is on (`-1` for none). */
  count: number
  current: number
  capped: boolean
  error?: string
  readonly?: boolean
}>()
const emit = defineEmits<{
  next: []
  previous: []
  replace: []
  replaceAll: []
  close: []
}>()
const query = defineModel<CodeSearchQuery>('query', { required: true })
const showReplace = defineModel<boolean>('showReplace', { default: false })
const ns = useNamespace('code-search')
const apple = isApplePlatform()

const findInput = ref<HTMLInputElement>()
const replaceInput = ref<HTMLInputElement>()

const set = (patch: Partial<CodeSearchQuery>) => (query.value = { ...query.value, ...patch })

const status = computed(() => {
  const m = props.messages
  if (props.error) return m.invalidRegexp
  if (!query.value.search) return ''
  if (!props.count) return m.noMatches
  if (props.capped) return format(m.matchMany, { count: props.count })
  if (props.current >= 0)
    return format(m.matchIndex, { index: props.current + 1, count: props.count })
  return format(m.matchCount, { count: props.count })
})

function onFindKeydown(event: KeyboardEvent) {
  if (isComposing(event)) return
  if (event.key === 'Enter') {
    event.preventDefault()
    if (event.shiftKey) emit('previous')
    else emit('next')
  }
}

function onReplaceKeydown(event: KeyboardEvent) {
  if (isComposing(event)) return
  if (event.key === 'Enter') {
    event.preventDefault()
    const all = apple ? event.metaKey : event.ctrlKey
    if (all) emit('replaceAll')
    else emit('replace')
  }
}

/** Keys anywhere in the panel, its buttons included: Esc closes, the search keys move between the boxes. */
function onKeydown(event: KeyboardEvent) {
  if (isComposing(event)) return
  const mod = apple ? event.metaKey : event.ctrlKey
  const key = event.key.toLowerCase()
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  } else if (
    !props.readonly &&
    ((mod && !event.altKey && key === 'h') ||
      (apple && event.metaKey && event.altKey && event.code === 'KeyF'))
  ) {
    event.preventDefault()
    showReplace.value = true
    focus('replace')
  } else if (mod && !event.altKey && key === 'f') {
    event.preventDefault()
    focus('find')
  }
}

/** Puts the focus in the search box (or the replace box) with its text selected. */
function focus(which: 'find' | 'replace' = 'find') {
  nextTick(() => {
    const el = which === 'replace' ? (replaceInput.value ?? findInput.value) : findInput.value
    el?.focus()
    el?.select()
  })
}

defineExpose({ focus })
</script>

<template>
  <div :class="ns.b()" role="search" :aria-label="messages.search" @keydown="onKeydown">
    <DouButton
      v-if="!readonly"
      :class="ns.e('expand')"
      variant="ghost"
      size="sm"
      :aria-label="messages.toggleReplace"
      :aria-expanded="showReplace"
      :title="messages.toggleReplace"
      @click="showReplace = !showReplace"
    >
      <ChevronDownIcon v-if="showReplace" />
      <ChevronRightIcon v-else />
    </DouButton>
    <div :class="ns.e('rows')">
      <div :class="ns.e('row')">
        <div :class="[ns.e('field'), ns.is('invalid', !!error)]">
          <input
            ref="findInput"
            :class="ns.e('input')"
            :value="query.search"
            :aria-label="messages.find"
            :placeholder="messages.find"
            :aria-invalid="!!error || undefined"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            @input="set({ search: ($event.target as HTMLInputElement).value })"
            @keydown="onFindKeydown"
          />
          <DouToggle
            :pressed="!!query.caseSensitive"
            size="sm"
            :aria-label="messages.caseSensitive"
            :title="messages.caseSensitive"
            @update:pressed="set({ caseSensitive: $event })"
          >
            <LetterCaseIcon />
          </DouToggle>
          <DouToggle
            :pressed="!!query.wholeWord"
            size="sm"
            :aria-label="messages.wholeWord"
            :title="messages.wholeWord"
            @update:pressed="set({ wholeWord: $event })"
          >
            <WholeWordIcon />
          </DouToggle>
          <DouToggle
            :pressed="!!query.regexp"
            size="sm"
            :aria-label="messages.regexp"
            :title="messages.regexp"
            @update:pressed="set({ regexp: $event })"
          >
            <RegexIcon />
          </DouToggle>
        </div>
        <span :class="[ns.e('status'), ns.is('empty', !count)]" aria-live="polite">{{
          status
        }}</span>
        <DouButton
          variant="ghost"
          size="sm"
          :disabled="!count"
          :aria-label="messages.previous"
          :title="messages.previous"
          @click="emit('previous')"
        >
          <ChevronUpIcon />
        </DouButton>
        <DouButton
          variant="ghost"
          size="sm"
          :disabled="!count"
          :aria-label="messages.next"
          :title="messages.next"
          @click="emit('next')"
        >
          <ChevronDownIcon />
        </DouButton>
        <DouButton
          variant="ghost"
          size="sm"
          :aria-label="messages.close"
          :title="messages.close"
          @click="emit('close')"
        >
          <CloseIcon />
        </DouButton>
      </div>
      <div v-if="showReplace && !readonly" :class="ns.e('row')">
        <div :class="ns.e('field')">
          <input
            ref="replaceInput"
            :class="ns.e('input')"
            :value="query.replace ?? ''"
            :aria-label="messages.replace"
            :placeholder="messages.replace"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            @input="set({ replace: ($event.target as HTMLInputElement).value })"
            @keydown="onReplaceKeydown"
          />
        </div>
        <DouButton
          variant="ghost"
          size="sm"
          :disabled="!count"
          :aria-label="messages.replaceOne"
          :title="messages.replaceOne"
          @click="emit('replace')"
        >
          <ReplaceIcon />
        </DouButton>
        <DouButton
          variant="ghost"
          size="sm"
          :disabled="!count"
          :aria-label="messages.replaceAll"
          :title="messages.replaceAll"
          @click="emit('replaceAll')"
        >
          <ReplaceAllIcon />
        </DouButton>
      </div>
    </div>
  </div>
</template>
