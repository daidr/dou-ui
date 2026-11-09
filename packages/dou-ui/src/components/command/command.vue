<script setup lang="ts">
import { SearchIcon } from '@dou-ui/icons'
import { computed, nextTick, onUpdated, ref, useId, useTemplateRef, watch } from 'vue'
import { GROUP_START, useGroupedWindow } from '../../composables/use-grouped-window'
import { ariaHotkey, useApplePlatform } from '../../composables/use-hotkey'
import { useMeasuredSizes } from '../../composables/use-measured-sizes'
import { isComposing } from '../../utils/keyboard'
import { useNamespace } from '../../utils/namespace'
import { devWarn } from '../../utils/status-check'
import { useLocale } from '../config-provider/use-config'
import { DouKbd } from '../kbd'
import { matchCommand } from './command'
import type {
  CommandExpose,
  CommandItem,
  CommandProps,
  CommandSlots,
  CommandValue,
} from './command'

defineOptions({ name: 'DouCommand' })

const props = withDefaults(defineProps<CommandProps>(), {
  loop: true,
  maxHeight: 320,
  virtual: undefined,
})
const query = defineModel<string>('query', { default: '' })
const emit = defineEmits<{ select: [item: CommandItem] }>()
const slots = defineSlots<CommandSlots>()

const ns = useNamespace('command')
const apple = useApplePlatform()
const { t } = useLocale()
const id = `dou-command-${useId()}`
const listboxId = `${id}-list`
const optionId = (index: number) => `${id}-option-${index}`

interface Entry {
  item: CommandItem
  indices: number[]
  index: number
}
interface Group {
  name: string | undefined
  entries: Entry[]
}

// The matching items, best first, gathered under their groups. Without a
// query the items keep their own order.
const groups = computed<Group[]>(() => {
  const text = query.value.trim()
  const filter = props.filter ?? matchCommand
  let matched = props.items.map((item, order) => ({
    item,
    order,
    match: text ? filter(text, item) : { score: 0, indices: [] },
  }))
  if (text) {
    const kept = matched.filter((entry) => entry.match)
    kept.sort((a, b) => b.match!.score - a.match!.score || a.order - b.order)
    matched = kept
  }
  const byName = new Map<string | undefined, Group>()
  for (const { item, match } of matched) {
    let group = byName.get(item.group)
    if (!group) byName.set(item.group, (group = { name: item.group, entries: [] }))
    group.entries.push({ item, indices: match!.indices, index: 0 })
  }
  // Ungrouped items lead, and every entry learns its place in the flat list.
  const named = [...byName.values()].filter((group) => group.name !== undefined)
  const list = byName.has(undefined) ? [byName.get(undefined)!, ...named] : named
  let index = 0
  for (const group of list) for (const entry of group.entries) entry.index = index++
  return list
})
const flat = computed(() => groups.value.flatMap((group) => group.entries))

const active = ref(-1)
const enabled = (index: number) => !!flat.value[index] && !flat.value[index]!.item.disabled

function move(from: number, step: 1 | -1) {
  const count = flat.value.length
  for (let offset = 1; offset <= count; offset++) {
    let index = from + step * offset
    if (props.loop) index = ((index % count) + count) % count
    else if (index < 0 || index >= count) return
    if (enabled(index)) {
      active.value = index
      return
    }
  }
}
const first = () => move(-1, 1)

// A parent that re-renders passes a new but equal list: only a different
// list of items moves the highlight back to the top.
const flatKey = computed(() =>
  flat.value.map((entry) => `${typeof entry.item.value}:${entry.item.value}`).join('\u0000'),
)
watch(
  flatKey,
  () => {
    active.value = -1
    first()
  },
  { immediate: true },
)

const listRef = useTemplateRef<HTMLElement>('list')

// Long lists render only the items in view. With `itemSize` every row is
// that tall; without it rows grow to fit and are measured once rendered,
// rows not rendered yet count as tall as the last ones measured, and a row
// changing height above the view keeps what is in view in place.
const fixed = computed(() => props.itemSize !== undefined)
function fixedSize(item: CommandItem) {
  const size = props.itemSize
  return typeof size === 'function' ? size(item) : size
}
/** Each item's group and place in it, by its index in the flat list. */
const places = computed(() =>
  groups.value.flatMap((group, at) => group.entries.map((_, index) => [at, index] as const)),
)
let estimate: number | undefined
const measured = useMeasuredSizes<CommandValue>({
  count: () => flat.value.length,
  keyOf: (index) => flat.value[index]!.item.value,
  estimate: () => estimate ?? 36,
  container: () => listRef.value,
  start: (index) => windowing.startOf(...places.value[index]!),
})
const windowing = useGroupedWindow({
  container: () => listRef.value,
  sizes: () => groups.value.map((group) => group.entries.length),
  itemSize: (group, index) => {
    const entry = groups.value[group]!.entries[index]!
    return fixedSize(entry.item) ?? measured.sizeOf(entry.index)
  },
  virtual: () => props.virtual,
})
const groupWindows = computed(() =>
  groups.value.map((group, at) => {
    const view = windowing.windows.value[at]!
    return { ...view, entries: group.entries.slice(view.from, view.to) }
  }),
)
watch(flatKey, () => {
  if (listRef.value) listRef.value.scrollTop = 0
})
watch(
  () => props.items,
  () => (estimate = undefined),
)

function trackRow(el: unknown, entry: Entry) {
  if (windowing.enabled.value && !fixed.value) {
    measured.track(el as Element | null, entry.item.value, entry.index)
  }
}
onUpdated(() => {
  measured.prune()
  if (!windowing.enabled.value || !listRef.value) return
  const rows = listRef.value.querySelectorAll<HTMLElement>('[role="option"]')
  if (!fixed.value) {
    // Rows still to be rendered are taken to be like the first ones shown.
    // Set once: a later change would move every row not measured yet.
    if (estimate === undefined) {
      let sum = 0
      for (const row of rows) sum += row.offsetHeight
      if (sum) estimate = sum / rows.length
    }
    return
  }
  // A row cut to its size overlaps the next one: say so while developing.
  if (process.env.NODE_ENV !== 'production') {
    for (const row of rows) {
      if (row.scrollHeight <= row.clientHeight + 1) continue
      return devWarn(
        '[dou-ui] DouCommand: an item is taller than `itemSize`. Pass a larger `itemSize`, or leave it out to have rows measured.',
      )
    }
  }
})

// Bring the active item into view. A far jump in a virtual list first
// scrolls to where the item is estimated to be; once the rows there are
// rendered and measured, it aims again, for a few frames at most.
async function reveal(index: number, settle: number) {
  if (windowing.enabled.value) {
    const place = places.value[index]
    if (place) windowing.scrollToItem(...place)
  }
  await nextTick()
  if (index !== active.value) return
  listRef.value?.querySelector(`#${CSS.escape(optionId(index))}`)?.scrollIntoView?.({
    block: 'nearest',
  })
  if (settle > 0 && windowing.enabled.value && !fixed.value) {
    if (typeof requestAnimationFrame !== 'undefined')
      requestAnimationFrame(() => index === active.value && void reveal(index, settle - 1))
  }
}
watch(active, (index) => {
  if (index >= 0) void reveal(index, 3)
})

function choose(index: number) {
  if (!enabled(index)) return
  emit('select', flat.value[index]!.item)
}

function onKeydown(event: KeyboardEvent) {
  if (isComposing(event)) return
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      return move(active.value, 1)
    case 'ArrowUp':
      event.preventDefault()
      return move(active.value < 0 ? flat.value.length : active.value, -1)
    case 'Enter':
      event.preventDefault()
      return choose(active.value)
  }
  // Ctrl/⌘ with Home and End leave the caret alone and jump through the list.
  if ((event.ctrlKey || event.metaKey) && (event.key === 'Home' || event.key === 'End')) {
    event.preventDefault()
    if (event.key === 'Home') first()
    else move(flat.value.length, -1)
  }
}

function parts(entry: Entry) {
  const label = entry.item.label
  if (!entry.indices.length) return [{ text: label, match: false }]
  const picked = new Set(entry.indices)
  const result: { text: string; match: boolean }[] = []
  for (let index = 0; index < label.length; index++) {
    const match = picked.has(index)
    const last = result.at(-1)
    if (last && last.match === match) last.text += label[index]
    else result.push({ text: label[index]!, match })
  }
  return result
}

function rowStyle(entry: Entry) {
  const size = windowing.enabled.value ? fixedSize(entry.item) : undefined
  return size === undefined ? undefined : { height: `${size}px`, minHeight: `${size}px` }
}

const inputRef = useTemplateRef<HTMLInputElement>('input')
defineExpose<CommandExpose>({ focus: () => inputRef.value?.focus() })

const maxHeight = computed(() =>
  typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight,
)
</script>

<template>
  <div :class="ns.b()">
    <div :class="ns.e('search')">
      <span :class="ns.e('prefix')" aria-hidden="true">
        <slot name="prefix">
          <SearchIcon />
        </slot>
      </span>
      <input
        ref="input"
        v-model="query"
        :class="ns.e('input')"
        type="text"
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        aria-autocomplete="list"
        aria-expanded="true"
        :aria-controls="listboxId"
        :aria-activedescendant="active >= 0 ? optionId(active) : undefined"
        :aria-label="ariaLabel ?? placeholder ?? t('command.placeholder')"
        :placeholder="placeholder ?? t('command.placeholder')"
        @keydown="onKeydown"
      />
    </div>
    <div
      :id="listboxId"
      ref="list"
      role="listbox"
      :class="ns.e('list')"
      :style="{ maxHeight }"
      :aria-label="ariaLabel ?? placeholder ?? t('command.placeholder')"
    >
      <div
        v-for="(group, groupIndex) in groups"
        :key="group.name ?? ''"
        role="group"
        :class="ns.e('group')"
        :aria-labelledby="group.name ? `${id}-group-${groupIndex}` : undefined"
      >
        <div
          v-if="group.name"
          :id="`${id}-group-${groupIndex}`"
          :class="ns.e('group-label')"
          aria-hidden="true"
        >
          {{ group.name }}
        </div>
        <div
          v-if="windowing.enabled.value"
          role="presentation"
          :[GROUP_START]="''"
          :style="{ height: `${groupWindows[groupIndex]!.before}px` }"
        />
        <div
          v-for="entry in groupWindows[groupIndex]!.entries"
          :id="optionId(entry.index)"
          :key="String(entry.item.value)"
          role="option"
          :aria-selected="entry.index === active"
          :aria-setsize="windowing.enabled.value ? flat.length : undefined"
          :aria-posinset="windowing.enabled.value ? entry.index + 1 : undefined"
          :aria-disabled="entry.item.disabled || undefined"
          :aria-keyshortcuts="
            entry.item.shortcut ? ariaHotkey(entry.item.shortcut, apple) : undefined
          "
          :class="[
            ns.e('item'),
            ns.is('active', entry.index === active),
            ns.is('disabled', !!entry.item.disabled),
          ]"
          :ref="(el) => trackRow(el, entry)"
          :style="rowStyle(entry)"
          @mousedown.prevent
          @click="choose(entry.index)"
          @mousemove="enabled(entry.index) && (active = entry.index)"
        >
          <slot
            name="item"
            :item="entry.item"
            :active="entry.index === active"
            :indices="entry.indices"
          >
            <span :class="ns.e('label')">
              <template v-for="(part, at) in parts(entry)" :key="at">
                <mark v-if="part.match" :class="ns.e('match')">{{ part.text }}</mark>
                <template v-else>{{ part.text }}</template>
              </template>
            </span>
            <span v-if="entry.item.description" :class="ns.e('description')">
              {{ entry.item.description }}
            </span>
            <DouKbd
              v-if="entry.item.shortcut"
              :class="ns.e('shortcut')"
              size="sm"
              :keys="entry.item.shortcut"
            />
          </slot>
        </div>
        <div
          v-if="windowing.enabled.value && groupWindows[groupIndex]!.after"
          role="presentation"
          :style="{ height: `${groupWindows[groupIndex]!.after}px` }"
        />
      </div>
      <div v-if="!flat.length" :class="ns.e('empty')" role="presentation">
        <slot name="empty">{{ emptyText ?? t('command.empty') }}</slot>
      </div>
    </div>
    <div v-if="slots.footer" :class="ns.e('footer')"><slot name="footer" /></div>
  </div>
</template>
