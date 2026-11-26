<script setup lang="ts">
import { PaletteIcon } from '@dou-ui/icons'
import { DouColorPanel, DouPopover, DouTooltip } from 'dou-ui'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowReactive,
  useTemplateRef,
  watch,
} from 'vue'
import { useFlowEditor } from '../context'
import type { FlowToolbarColor, FlowToolbarItem } from '../core/menu'
import { plainColor } from '../export/color'

const props = defineProps<{
  /** Each extension's buttons, with a divider between them. */
  groups: FlowToolbarItem[][]
  /** The selection on screen, in px from the editor's top left. */
  anchor: {
    x: number
    top: number
    bottom: number
    /** Boxes it should rather not cover, e.g. nodes beside selected edges, in the same px. */
    avoid?: { left: number; top: number; right: number; bottom: number }[]
  }
  size: { width: number; height: number }
}>()

const { messages, root, selection, showMenu, menuFrom } = useFlowEditor()

const opensMenu = (item: FlowToolbarItem) => !!item.children?.length
const opensColor = (item: FlowToolbarItem) => !!item.color

// Color popover state -------------------------------------------------------------------

const openColor = ref<string | null>(null)
const customKey = ref<string | null>(null)
const customColor = ref<string | null>(null)
let closeActiveGroup: (() => void) | null = null

function finishColorGroup() {
  closeActiveGroup?.()
  closeActiveGroup = null
}

function closeColorPopover() {
  finishColorGroup()
  openColor.value = null
  customKey.value = null
}

function isCustomColor(color: FlowToolbarColor) {
  const value = color.value
  if (!value || color.none || !color.swatch) return false
  return !color.presets.some((preset) => preset.value === value)
}

function customSwatch(color: FlowToolbarColor) {
  return isCustomColor(color) ? color.swatch : undefined
}

function setColorOpen(key: string, open: boolean) {
  if (open) {
    if (openColor.value && openColor.value !== key) finishColorGroup()
    openColor.value = key
  } else if (openColor.value === key) {
    closeColorPopover()
  }
}

function pickColor(color: FlowToolbarColor, value: string | undefined) {
  finishColorGroup()
  color.select(value, { live: false })
  openColor.value = null
  customKey.value = null
  void nextTick(() => root.value?.focus({ preventScroll: true }))
}

const CSS_COLOR = /^(#|rgb|hsl|hsv|hwb|lab|lch|oklab|oklch)/i

function toggleCustom(item: FlowToolbarItem, event: MouseEvent) {
  const color = item.color
  if (!color) return
  if (customKey.value === item.key) {
    finishColorGroup()
    customKey.value = null
    return
  }
  customKey.value = item.key
  if (isCustomColor(color) && color.value && CSS_COLOR.test(color.value)) {
    customColor.value = color.value
    return
  }
  // Start from the active swatch's computed color so tweaking a preset or tone begins near it.
  const swatches = (event.currentTarget as HTMLElement).closest('.dou-flow-color-popover__swatches')
  const active = swatches?.querySelector<HTMLElement>('[aria-pressed="true"]:not(.is-default)')
  const raw = active && getComputedStyle(active).color
  customColor.value = raw ? plainColor(raw) || null : null
}

function onCustomInput(color: FlowToolbarColor, value: string | null | undefined) {
  customColor.value = value ?? null
  if (value) {
    closeActiveGroup = color.close ?? null
    color.select(value, { live: true })
  }
}

function onCustomChange(color: FlowToolbarColor, value: string | null | undefined) {
  customColor.value = value ?? null
  if (value) color.select(value, { live: false })
  closeActiveGroup = null
}

// Close open color popover when a context menu opens, selection changes, or the button vanishes.
watch(menuFrom, (el) => {
  if (el) closeColorPopover()
})
watch(
  () => [selection.value.nodes.join(','), selection.value.edges.join(',')],
  () => closeColorPopover(),
)
watch(
  () => props.groups,
  (groups) => {
    if (openColor.value && !groups.flat().some((item) => item.key === openColor.value)) {
      closeColorPopover()
    }
  },
)
onBeforeUnmount(() => finishColorGroup())

// A button with `children` opens its choices under it; a click from the
// keyboard (no pointer, `detail` 0) puts focus on the one in use.
function press(item: FlowToolbarItem, event: MouseEvent) {
  closeColorPopover()
  if (!opensMenu(item)) return item.run?.()
  const button = event.currentTarget as HTMLElement
  const box = button.getBoundingClientRect()
  showMenu(item.children!, { x: box.left, y: box.bottom + 4 }, button, {
    focusChecked: event.detail === 0,
  })
}
// By key: extensions give new item objects on every update.
const warned = new Set<string>()
/** Says once when a button does nothing when pressed. */
function warnOnce(item: FlowToolbarItem) {
  // the app's bundler replaces this, as for Vue's own warnings
  if (process.env.NODE_ENV === 'production' || warned.has(item.key)) return
  if (item.run || opensMenu(item) || opensColor(item)) return
  warned.add(item.key)
  console.warn(
    `[@dou-ui/flow] the toolbar item "${item.key}" has no run, children or color: pressing it does nothing`,
  )
}
watch(
  () => props.groups,
  (groups) => groups.flat().forEach(warnOnce),
  { immediate: true },
)

const el = useTemplateRef<HTMLElement>('el')
const box = ref({ width: 0, height: 0 })

watch(
  [el, () => props.groups],
  () => {
    if (el.value) box.value = { width: el.value.offsetWidth, height: el.value.offsetHeight }
  },
  { flush: 'post' },
)

/** Room between the toolbar and the selection, and the editor's edges. */
const GAP = 8

/*
 * What it keeps clear of is read from the page, so it is read again once the
 * page has caught up with the selection: a handle drawn for the selected node
 * appears in the same update as the toolbar's new anchor.
 */
const measured = ref(0)
watch(
  () => props.anchor,
  () => measured.value++,
  { flush: 'post', immediate: true },
)

/**
 * Boxes of what the toolbar must not cover, from the editor's top left: what
 * floats over the canvas, e.g. a whiteboard's tools, and handles on the
 * selection, e.g. a whiteboard's turn handle.
 */
function overlays() {
  void measured.value
  const editor = root.value
  if (!editor) return []
  const origin = editor.getBoundingClientRect()
  return [...editor.querySelectorAll<HTMLElement>('[data-flow-overlay]')].map((item) => {
    const r = item.getBoundingClientRect()
    return {
      left: r.left - origin.left,
      top: r.top - origin.top,
      right: r.right - origin.left,
      bottom: r.bottom - origin.top,
    }
  })
}

// Above the selection, below it when there is no room or it would cover
// something floating there, kept inside the editor.
const place = computed(() => {
  const { width, height } = box.value
  const { anchor, size } = props
  const left = Math.min(Math.max(anchor.x - width / 2, GAP), size.width - width - GAP)
  const above = anchor.top - GAP - height
  const under = anchor.bottom + GAP
  const boxes = [...overlays(), ...(anchor.avoid ?? [])]
  const hits = (top: number) =>
    boxes.filter(
      (o) => left < o.right && left + width > o.left && top < o.bottom && top + height > o.top,
    )
  const fits = (top: number) => top >= GAP && top + height <= size.height - GAP && !hits(top).length
  // Above, else below; when something is in the way, just past it.
  const candidates = [above, under]
  const over = hits(above)
  if (over.length) candidates.push(Math.min(...over.map((o) => o.top)) - GAP - height)
  const beneath = hits(under)
  if (beneath.length) candidates.push(Math.max(...beneath.map((o) => o.bottom)) + GAP)
  const top = candidates.find(fits) ?? (above >= GAP ? above : under)
  return { left, top: Math.min(Math.max(top, GAP), size.height - height - GAP) }
})
const style = computed(() => ({
  left: `${Math.round(place.value.left)}px`,
  top: `${Math.round(place.value.top)}px`,
}))
/** Tips open away from the selection, so they never cover it. */
const tipPlacement = computed(() => (place.value.top < props.anchor.top ? 'top' : 'bottom'))
const popoverPlacement = computed(() =>
  place.value.top < props.anchor.top ? 'top-start' : 'bottom-start',
)

/** The buttons by key, to tell which one opened the menu. */
const buttons = shallowReactive(new Map<string, Element>())
function setButton(key: string, button: unknown) {
  if (button instanceof Element) buttons.set(key, button)
  else buttons.delete(key)
}

// The selection scrolled out of view: nothing to point at.
const hidden = computed(
  () =>
    props.anchor.bottom < 0 ||
    props.anchor.top > props.size.height ||
    props.anchor.x < 0 ||
    props.anchor.x > props.size.width,
)
watch(hidden, (isHidden) => {
  if (isHidden) {
    openColor.value = null
    customKey.value = null
  }
})
</script>

<template>
  <div
    v-show="!hidden"
    ref="el"
    class="dou-flow-toolbar"
    role="toolbar"
    :aria-label="messages.toolbar"
    :style="style"
  >
    <template v-for="(group, i) in groups" :key="i">
      <span v-if="i > 0" class="dou-flow-controls__divider" />
      <template v-for="item in group" :key="item.key">
        <DouTooltip
          v-if="item.color"
          :content="item.label"
          :shortcut="item.shortcut"
          :disabled="openColor === item.key"
          :placement="tipPlacement"
        >
          <DouPopover
            :open="openColor === item.key"
            :placement="popoverPlacement"
            :disabled="item.disabled"
            class="dou-flow-color-popover"
            @update:open="setColorOpen(item.key, $event)"
          >
            <button
              :ref="(button) => setButton(item.key, button)"
              type="button"
              class="dou-flow-controls__button dou-flow-toolbar__color"
              :class="[
                `is-kind-${item.color.kind ?? 'stroke'}`,
                {
                  'is-active': openColor === item.key,
                  'has-swatch': !!item.color.swatch,
                  'is-none': !!item.color.none,
                },
              ]"
              :style="item.color.swatch ? { '--dou-flow-swatch': item.color.swatch } : undefined"
              :disabled="item.disabled"
              :aria-label="item.label"
              aria-haspopup="dialog"
              :aria-expanded="openColor === item.key"
            >
              <span class="dou-flow-toolbar__color-glyph">
                <component :is="item.icon" class="dou-flow-toolbar__color-icon" />
                <svg
                  v-if="(item.color.kind ?? 'stroke') !== 'text'"
                  class="dou-flow-toolbar__color-bar"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    v-if="item.color.swatch && item.color.kind === 'fill'"
                    class="dou-flow-toolbar__color-bar-halo"
                    d="M4 20h16"
                    vector-effect="non-scaling-stroke"
                  />
                  <path
                    class="dou-flow-toolbar__color-bar-line"
                    :d="item.color.none ? 'M4 20h2.5 M10.75 20h2.5 M17.5 20h2.5' : 'M4 20h16'"
                    vector-effect="non-scaling-stroke"
                  />
                </svg>
              </span>
            </button>
            <template #content>
              <div class="dou-flow-color-popover__body">
                <div class="dou-flow-color-popover__swatches" role="group" :aria-label="item.label">
                  <button
                    type="button"
                    class="dou-flow-color-popover__swatch is-default"
                    :class="`is-kind-${item.color.kind ?? 'stroke'}`"
                    :aria-pressed="item.color.value === undefined"
                    :aria-label="item.color.defaultLabel"
                    :title="item.color.defaultLabel"
                    @click="pickColor(item.color, undefined)"
                  />
                  <button
                    v-for="preset in item.color.presets"
                    :key="preset.value"
                    type="button"
                    class="dou-flow-color-popover__swatch"
                    :class="`is-kind-${item.color.kind ?? 'stroke'}`"
                    :style="{ '--dou-flow-swatch': preset.swatch }"
                    :aria-pressed="item.color.value === preset.value"
                    :aria-label="preset.label"
                    :title="preset.label"
                    @click="pickColor(item.color, preset.value)"
                  >
                    <span v-if="item.color.kind === 'text'" aria-hidden="true">A</span>
                  </button>
                  <button
                    type="button"
                    class="dou-flow-color-popover__swatch is-custom"
                    :class="[
                      `is-kind-${item.color.kind ?? 'stroke'}`,
                      { 'has-custom': isCustomColor(item.color) },
                    ]"
                    :style="
                      customSwatch(item.color)
                        ? { '--dou-flow-swatch': customSwatch(item.color) }
                        : undefined
                    "
                    :aria-pressed="isCustomColor(item.color)"
                    :aria-expanded="customKey === item.key"
                    :aria-label="item.color.customLabel"
                    :title="item.color.customLabel"
                    @click="toggleCustom(item, $event)"
                  >
                    <span
                      v-if="isCustomColor(item.color) && item.color.kind === 'text'"
                      aria-hidden="true"
                    >
                      A
                    </span>
                    <PaletteIcon v-else-if="!isCustomColor(item.color)" />
                  </button>
                </div>
                <button
                  v-if="item.color.noneOption"
                  type="button"
                  class="dou-flow-color-popover__none"
                  :aria-pressed="!!item.color.none"
                  @click="pickColor(item.color, item.color.noneOption.value)"
                >
                  <component
                    :is="item.color.noneOption.icon"
                    v-if="item.color.noneOption.icon"
                    class="dou-flow-color-popover__none-icon"
                  />
                  <span v-else class="dou-flow-color-popover__none-swatch" aria-hidden="true" />
                  <span>{{ item.color.noneOption.label }}</span>
                </button>
                <DouColorPanel
                  v-if="customKey === item.key"
                  :model-value="customColor"
                  class="dou-flow-color-popover__panel"
                  :bordered="false"
                  format="hex"
                  show-alpha
                  show-input
                  @update:model-value="onCustomInput(item.color, $event)"
                  @change="onCustomChange(item.color, $event)"
                />
              </div>
            </template>
          </DouPopover>
        </DouTooltip>
        <!-- The tip stands aside while the button's menu is open. -->
        <DouTooltip
          v-else
          :content="item.label"
          :shortcut="item.shortcut"
          :disabled="!!menuFrom && menuFrom === buttons.get(item.key)"
          :placement="tipPlacement"
        >
          <button
            :ref="(button) => setButton(item.key, button)"
            type="button"
            class="dou-flow-controls__button"
            :class="{ 'is-active': item.pressed }"
            :disabled="item.disabled"
            :aria-label="item.label"
            :aria-pressed="opensMenu(item) ? undefined : (item.pressed ?? undefined)"
            :aria-haspopup="opensMenu(item) ? 'menu' : undefined"
            :aria-expanded="
              opensMenu(item) ? !!menuFrom && menuFrom === buttons.get(item.key) : undefined
            "
            @click="press(item, $event)"
          >
            <component :is="item.icon" />
          </button>
        </DouTooltip>
      </template>
    </template>
  </div>
</template>
