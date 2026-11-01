<script setup lang="ts">
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CloseIcon,
  ReplaceAllIcon,
  ReplaceIcon,
} from '@dou-ui/icons'
import { computed, nextTick, ref } from 'vue'
import { isApplePlatform, useApplePlatform } from '../../composables/use-hotkey'
import { isComposing } from '../../utils/keyboard'
import { useNamespace } from '../../utils/namespace'
import { DouButton } from '../button'
import { useLocale } from '../config-provider/use-config'
import { DouTooltip } from '../tooltip'
import type { FindReplaceExpose, FindReplaceProps, FindReplaceSlots } from './find-replace'

defineOptions({ name: 'DouFindReplace' })

const props = withDefaults(defineProps<FindReplaceProps>(), {
  count: 0,
  current: -1,
  capped: false,
  searching: false,
  error: undefined,
  readonly: false,
})
const emit = defineEmits<{
  next: []
  previous: []
  replaceOne: []
  replaceAll: []
  close: []
}>()
defineSlots<FindReplaceSlots>()

/** The text to find. */
const search = defineModel<string>('search', { default: '' })
/** The text that replaces a match. */
const replacement = defineModel<string>('replace', { default: '' })
/** Whether the replace box is shown. */
const replacing = defineModel<boolean>('replacing', { default: false })

const ns = useNamespace('find-replace')
const { t } = useLocale()
// known after mounting, so the server-rendered hint matches the first client render
const apple = useApplePlatform()
/** The key that shows the replace box; ⌘H hides the app on Apple platforms. */
const replaceKey = computed(() => (apple.value ? 'mod+alt+f' : 'mod+h'))

const findInput = ref<HTMLInputElement>()
const replaceInput = ref<HTMLInputElement>()

const status = computed(() => {
  if (props.error) return props.error
  if (!search.value || props.searching) return ''
  if (!props.count) return t('findReplace.noMatches')
  if (props.capped) return t('findReplace.matchMany', { count: props.count })
  if (props.current >= 0)
    return t('findReplace.matchIndex', { index: props.current + 1, count: props.count })
  return t('findReplace.matchCount', { count: props.count })
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
    if (isApplePlatform() ? event.metaKey : event.ctrlKey) emit('replaceAll')
    else emit('replaceOne')
  }
}

/** Keys anywhere in the panel, its buttons included: Esc closes, the find keys move between the boxes. */
function onKeydown(event: KeyboardEvent) {
  if (isComposing(event)) return
  const mac = isApplePlatform()
  const mod = mac ? event.metaKey : event.ctrlKey
  const key = event.key.toLowerCase()
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('close')
  } else if (
    !props.readonly &&
    ((mod && !event.altKey && key === 'h') ||
      (mac && event.metaKey && event.altKey && event.code === 'KeyF'))
  ) {
    event.preventDefault()
    event.stopPropagation()
    replacing.value = true
    focus('replace')
  } else if (mod && !event.altKey && key === 'f') {
    event.preventDefault()
    event.stopPropagation()
    focus('find')
  }
}

/** Puts the focus in the find box (or the replace box) with its text selected. */
function focus(which: 'find' | 'replace' = 'find') {
  nextTick(() => {
    const el = which === 'replace' ? (replaceInput.value ?? findInput.value) : findInput.value
    el?.focus()
    el?.select()
  })
}

defineExpose<FindReplaceExpose>({ focus })
</script>

<template>
  <div :class="ns.b()" role="search" :aria-label="t('findReplace.label')" @keydown="onKeydown">
    <DouTooltip v-if="!readonly" :content="t('findReplace.toggleReplace')" :shortcut="replaceKey">
      <DouButton
        :class="ns.e('expand')"
        variant="ghost"
        size="sm"
        :aria-label="t('findReplace.toggleReplace')"
        :aria-expanded="replacing"
        @click="replacing = !replacing"
      >
        <ChevronDownIcon v-if="replacing" />
        <ChevronRightIcon v-else />
      </DouButton>
    </DouTooltip>
    <div :class="ns.e('rows')">
      <div :class="ns.e('row')">
        <div :class="[ns.e('field'), ns.is('invalid', !!error)]">
          <input
            ref="findInput"
            v-model="search"
            :class="ns.e('input')"
            :aria-label="t('findReplace.find')"
            :placeholder="t('findReplace.find')"
            :aria-invalid="!!error || undefined"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            @keydown="onFindKeydown"
          />
          <slot name="options" />
        </div>
        <span :class="[ns.e('status'), ns.is('empty', !count)]" aria-live="polite">{{
          status
        }}</span>
        <DouTooltip :content="t('findReplace.previous')" shortcut="shift+enter">
          <DouButton
            variant="ghost"
            size="sm"
            :disabled="!count"
            :aria-label="t('findReplace.previous')"
            @click="emit('previous')"
          >
            <ChevronUpIcon />
          </DouButton>
        </DouTooltip>
        <DouTooltip :content="t('findReplace.next')" shortcut="enter">
          <DouButton
            variant="ghost"
            size="sm"
            :disabled="!count"
            :aria-label="t('findReplace.next')"
            @click="emit('next')"
          >
            <ChevronDownIcon />
          </DouButton>
        </DouTooltip>
        <DouTooltip :content="t('findReplace.close')" shortcut="escape">
          <DouButton
            variant="ghost"
            size="sm"
            :aria-label="t('findReplace.close')"
            @click="emit('close')"
          >
            <CloseIcon />
          </DouButton>
        </DouTooltip>
      </div>
      <div v-if="replacing && !readonly" :class="ns.e('row')">
        <div :class="ns.e('field')">
          <input
            ref="replaceInput"
            v-model="replacement"
            :class="ns.e('input')"
            :aria-label="t('findReplace.replace')"
            :placeholder="t('findReplace.replace')"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            @keydown="onReplaceKeydown"
          />
        </div>
        <DouTooltip :content="t('findReplace.replaceOne')" shortcut="enter">
          <DouButton
            variant="ghost"
            size="sm"
            :disabled="!count"
            :aria-label="t('findReplace.replaceOne')"
            @click="emit('replaceOne')"
          >
            <ReplaceIcon />
          </DouButton>
        </DouTooltip>
        <DouTooltip :content="t('findReplace.replaceAll')" shortcut="mod+enter">
          <DouButton
            variant="ghost"
            size="sm"
            :disabled="!count"
            :aria-label="t('findReplace.replaceAll')"
            @click="emit('replaceAll')"
          >
            <ReplaceAllIcon />
          </DouButton>
        </DouTooltip>
      </div>
    </div>
  </div>
</template>
