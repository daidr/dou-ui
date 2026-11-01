<script setup lang="ts">
import { LetterCaseIcon, RegexIcon, WholeWordIcon } from '@dou-ui/icons'
import { DouFindReplace, DouToggle, DouTooltip, useLocale } from 'dou-ui'
import type { Node as PMNode } from 'prosemirror-model'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  currentMatch,
  matchAfter,
  previewMatch,
  replaceMatches,
  searchDoc,
  searchKey,
  selectMatch,
  setSearch,
  type EditorSearchQuery,
} from '../core/search'
import { useEditor } from '../editor'

defineOptions({ name: 'DouEditorSearchBar' })

const props = defineProps<{ readonly: boolean; skip: (node: PMNode) => boolean }>()
const emit = defineEmits<{ close: [] }>()
const replacing = defineModel<boolean>('replacing', { default: false })

const { view, state } = useEditor()
const { t } = useLocale()
const panel = ref<InstanceType<typeof DouFindReplace>>()

const search = computed(() => (state.value ? searchKey.getState(state.value) : undefined))
const query = computed<EditorSearchQuery>(() => search.value?.query ?? { search: '' })
const current = computed(() => (state.value ? currentMatch(state.value) : -1))

const options = [
  { key: 'caseSensitive', icon: LetterCaseIcon },
  { key: 'wholeWord', icon: WholeWordIcon },
  { key: 'regexp', icon: RegexIcon },
] as const

/** Puts in a new query; a new search selects the first match from the cursor on, as a preview. */
function setQuery(patch: Partial<EditorSearchQuery>) {
  const v = view.value
  if (!v) return
  const next = { ...query.value, ...patch }
  v.dispatch(setSearch(v.state.tr, { query: next }))
  if (Object.keys(patch).every((key) => key === 'replace')) return
  const preview = previewMatch(v.state)
  if (preview) v.dispatch(preview)
}

function go(step: 1 | -1) {
  const v = view.value
  const s = v && searchKey.getState(v.state)
  if (!v || !s?.matches.length) return
  const list = s.matches
  const i = currentMatch(v.state)
  const from = i >= 0 ? i : matchAfter(list, v.state.selection.from)
  const to = i >= 0 ? (i + step + list.length) % list.length : step > 0 ? from : from - 1
  v.dispatch(selectMatch(v.state, list[(to + list.length) % list.length]!))
}

function replaceOne() {
  const v = view.value
  if (!v || props.readonly) return
  const i = currentMatch(v.state)
  if (i < 0) return go(1)
  const m = searchKey.getState(v.state)!.matches[i]!
  const tr = replaceMatches(v.state, [m], query.value)
  // on to the next match after the replacement
  const end = tr.mapping.map(m.to)
  v.dispatch(tr)
  const list = searchKey.getState(v.state)!.matches
  if (list.length) v.dispatch(selectMatch(v.state, list[matchAfter(list, end)]!))
}

function replaceAll() {
  const v = view.value
  const s = v && searchKey.getState(v.state)
  if (!v || !s?.matches.length || props.readonly) return
  // every match, also past the number counted
  const list = s.capped
    ? searchDoc(v.state.doc, query.value, { limit: Infinity, skip: props.skip }).matches
    : s.matches
  v.dispatch(replaceMatches(v.state, list, query.value))
}

// The panel floats over the text: scrolling to a match keeps it below the panel, and a
// match the panel still covers, as one in the first line, moves the panel down past it.
const shift = ref(0)
let margin: unknown
onMounted(() => {
  const v = view.value
  const el = panel.value?.$el as HTMLElement | undefined
  if (!v || !el) return
  margin = v.someProp('scrollMargin')
  const top = el.getBoundingClientRect().height + 16
  v.setProps({ scrollMargin: { top, bottom: 8, left: 8, right: 8 } })
})
onBeforeUnmount(() => {
  const v = view.value
  if (v && !v.isDestroyed) v.setProps({ scrollMargin: margin as number | undefined })
})
watch(
  [current, state],
  () => {
    const v = view.value
    const el = panel.value?.$el as HTMLElement | undefined
    const m = current.value >= 0 ? search.value?.matches[current.value] : undefined
    if (!v || !el || !m) return (shift.value = 0)
    let start, end
    try {
      start = v.coordsAtPos(m.from)
      end = v.coordsAtPos(m.to)
    } catch {
      return (shift.value = 0)
    }
    const box = el.getBoundingClientRect()
    const top = box.top - shift.value
    const bottom = box.bottom - shift.value
    const covered =
      start.top < bottom &&
      end.bottom > top &&
      Math.min(start.left, end.left) < box.right &&
      Math.max(start.right, end.right) > box.left
    shift.value = covered ? Math.ceil(Math.max(start.bottom, end.bottom) - top + 6) : 0
  },
  { flush: 'post' },
)

defineExpose({
  focus: (which?: 'find' | 'replace') => panel.value?.focus(which),
  next: () => go(1),
  previous: () => go(-1),
})
</script>

<template>
  <DouFindReplace
    ref="panel"
    :style="shift ? { transform: `translateY(${shift}px)` } : undefined"
    v-model:replacing="replacing"
    :search="query.search"
    :replace="query.replace ?? ''"
    :count="search?.matches.length ?? 0"
    :current="current"
    :capped="search?.capped"
    :error="search?.error && t('findReplace.invalidRegexp')"
    :readonly="readonly"
    @update:search="setQuery({ search: $event })"
    @update:replace="setQuery({ replace: $event })"
    @next="go(1)"
    @previous="go(-1)"
    @replace-one="replaceOne"
    @replace-all="replaceAll"
    @close="emit('close')"
  >
    <template #options>
      <DouTooltip
        v-for="option in options"
        :key="option.key"
        :content="t(`findReplace.${option.key}`)"
      >
        <DouToggle
          :pressed="!!query[option.key]"
          size="sm"
          :aria-label="t(`findReplace.${option.key}`)"
          @update:pressed="setQuery({ [option.key]: $event })"
        >
          <component :is="option.icon" />
        </DouToggle>
      </DouTooltip>
    </template>
  </DouFindReplace>
</template>
