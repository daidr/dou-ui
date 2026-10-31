<script setup lang="ts">
import {
  BaselineIcon,
  BoldIcon,
  CellsMergeIcon,
  CheckIcon,
  ChevronDownIcon,
  DecimalDecreaseIcon,
  DecimalIncreaseIcon,
  FilterIcon,
  ItalicIcon,
  PaintBucketIcon,
  PaletteIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  SortIcon,
  RedoIcon,
  StrikethroughIcon,
  TableFreezeIcon,
  TableCheckIcon,
  TableHighlightIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextValignBottomIcon,
  TextValignMiddleIcon,
  TextValignTopIcon,
  TypeXIcon,
  UnderlineIcon,
  UndoIcon,
  WrapTextIcon,
} from '@dou-ui/icons'
import {
  DouButton,
  DouColorPanel,
  DouDropdown,
  DouDropdownItem,
  DouDropdownSub,
  DouPopover,
  DouToggle,
  DouToggleGroup,
  DouToolbar,
  DouToolbarSeparator,
  DouTooltip,
  type ToggleValue,
  type Tone,
} from 'dou-ui'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  useTemplateRef,
  watch,
  type Component,
} from 'vue'
import { useSheet } from '../context'
import { boundsOf, columnName, formatRange, inBounds, parseRange } from '../core/address'
import { alignOf, changeDecimals, formatValue } from '../core/format'
import type { SheetConditionalFormat, SheetStyle, SheetValidation } from '../core/model'
import FormatDialog from './format-dialog.vue'
import FormatList from './format-list.vue'
import ValidationDialog from './validation-dialog.vue'
import {
  barSwatch,
  LOOKS,
  SCALES,
  scaleSwatch,
  TONES,
  toneKey,
  type SheetScaleColors,
} from './format-presets'
import { format } from '../locale'
import type {
  SheetFormatOption,
  SheetToolbarProps,
  SheetToolbarSlots,
  SheetToolbarTool,
} from '../types'

defineOptions({ name: 'DouSheetToolbar' })

const props = defineProps<SheetToolbarProps>()
defineSlots<SheetToolbarSlots>()

const sheet = useSheet()
const { messages: m, active } = sheet

const DEFAULT_TOOLS: SheetToolbarTool[] = [
  'undo',
  'redo',
  '|',
  'format',
  'decimals',
  '|',
  'bold',
  'italic',
  'underline',
  'strike',
  '|',
  'color',
  'fill',
  '|',
  'align',
  'valign',
  'wrap',
  '|',
  'merge',
  'freeze',
  '|',
  'sort',
  'filter',
  'conditional',
  'validation',
  '|',
  'clear',
]

/** The tools to show, without separators at either end or two in a row. */
const tools = computed(() => {
  const out: SheetToolbarTool[] = []
  for (const tool of props.tools ?? DEFAULT_TOOLS)
    if (tool !== '|' || (out.length && out[out.length - 1] !== '|')) out.push(tool)
  if (out[out.length - 1] === '|') out.pop()
  return out
})

const disabled = computed(() => sheet.readonly.value)
const style = computed<SheetStyle>(() => sheet.styleAt(active.value))
const cellFormat = computed(() => sheet.formatAt(active.value))

// After a pointer press the keys go back to the grid; from the keyboard,
// focus stays on the toolbar.
let pointer = false
function onPointerDown(event: PointerEvent) {
  pointer = true
  // a press on a button doesn't take the focus from the grid (or the cell being edited)
  if (event.pointerType === 'mouse' && (event.target as Element).closest('button'))
    event.preventDefault()
}
function onKeyDown() {
  pointer = false
}
function done() {
  if (pointer) void nextTick(() => sheet.focus())
}

const menuOpen = ref<SheetToolbarTool | null>(null)
function onMenu(tool: SheetToolbarTool, open: boolean) {
  if (open) menuOpen.value = tool
  else if (menuOpen.value === tool) {
    menuOpen.value = null
    done()
  }
}

// Bold, italic, underline, strikethrough ------------------------------------------------

type StyleToggle = 'bold' | 'italic' | 'underline' | 'strike'
const STYLE: Record<StyleToggle, { icon: Component; key: string }> = {
  bold: { icon: BoldIcon, key: 'mod+b' },
  italic: { icon: ItalicIcon, key: 'mod+i' },
  underline: { icon: UnderlineIcon, key: 'mod+u' },
  strike: { icon: StrikethroughIcon, key: 'mod+shift+x' },
}
const isStyleTool = (tool: SheetToolbarTool): tool is StyleToggle => tool in STYLE

function toggle(name: StyleToggle, on: boolean) {
  sheet.styleSelection({ [name]: on || undefined })
  done()
}

// Number formats --------------------------------------------------------------------------

const formats = computed<SheetFormatOption[]>(
  () =>
    props.formats ?? [
      { label: m.value.formatGeneral, format: undefined, example: 1234.5 },
      { label: m.value.formatNumber, format: '#,##0.00', example: 1234.5 },
      { label: m.value.formatPercent, format: '0.00%', example: 0.1234 },
      { label: m.value.formatCurrency, format: m.value.currencyFormat, example: 1234.5 },
      { label: m.value.formatDate, format: 'yyyy-mm-dd', example: '2026-03-05' },
      { label: m.value.formatTime, format: 'hh:mm', example: '09:30' },
      { label: m.value.formatText, format: '@' },
    ],
)
/**
 * The option the cell's format is, or is with other decimals or grouping:
 * `¥#,##0.000` is still currency, `0.0%` still percent and `0.0` a number.
 */
const formatShown = computed(() => {
  const current = cellFormat.value
  const exact = formats.value.find((option) => option.format === current)
  if (exact || !current) return exact ?? null
  const kind = withoutDecimals(current)
  return (
    formats.value.find((option) => option.format && withoutDecimals(option.format) === kind) ?? null
  )
})
const formatLabel = computed(() => formatShown.value?.label ?? m.value.formatCustom)
// the kind of a format: without decimals and grouping, so `0.00` is a number like `#,##0.00`
const withoutDecimals = (pattern: string) =>
  changeDecimals(pattern, null, -99)!.replace(/[#,](?=[#,0]*0)/g, '')
const exampleOf = (option: SheetFormatOption) =>
  option.example == null ? '' : formatValue(option.example, option.format)

function setFormat(option: SheetFormatOption) {
  sheet.formatSelection(option.format)
  done()
}

function decimals(by: number) {
  sheet.formatSelection((old, value) => changeDecimals(old, value, by))
  done()
}

// Colors ----------------------------------------------------------------------------------

const toneLabel = (tone: Tone) => m.value[toneKey(tone)]

type ColorTool = 'color' | 'fill'
const colorOpen = ref<ColorTool | null>(null)
const custom = ref<ColorTool | null>(null)
const customColor = ref<string | null>(null)

/** The color a tool shows now: a tone, a CSS color, or `null` for none. */
function colorOf(tool: ColorTool) {
  const s = style.value
  return tool === 'color'
    ? { tone: s.color ? undefined : s.tone, css: s.color }
    : { tone: s.background ? undefined : s.fill, css: s.background }
}

/** What the mark under the icon is drawn in. */
function swatchOf(tool: ColorTool) {
  const { tone, css } = colorOf(tool)
  if (css) return css
  if (!tone) return undefined
  return tool === 'color' ? `var(--dou-color-${tone}-text)` : `var(--dou-color-${tone})`
}

function setColor(tool: ColorTool, value: { tone?: Tone; css?: string }, close = true) {
  sheet.styleSelection(
    tool === 'color'
      ? { tone: value.tone, color: value.css }
      : { fill: value.tone, background: value.css },
  )
  if (close) {
    colorOpen.value = null
    done()
  }
}

/** Opens the color panel, starting from the color the cell shows now. */
function openCustom(tool: ColorTool, event: MouseEvent) {
  custom.value = custom.value === tool ? null : tool
  const css = colorOf(tool).css
  if (css) customColor.value = css
  else {
    const shown = (event.currentTarget as HTMLElement)
      .closest('.dou-sheet-toolbar__colors')
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
    const look = shown && getComputedStyle(shown)
    customColor.value = (look && (tool === 'color' ? look.color : look.backgroundColor)) || null
  }
}
watch(colorOpen, (open) => {
  if (open) return
  custom.value = null
  done()
})

// Alignment -------------------------------------------------------------------------------

const ALIGN = [
  { value: 'left', icon: TextAlignLeftIcon, label: 'alignLeft' },
  { value: 'center', icon: TextAlignCenterIcon, label: 'alignCenter' },
  { value: 'right', icon: TextAlignRightIcon, label: 'alignRight' },
] as const
const VALIGN = [
  { value: 'top', icon: TextValignTopIcon, label: 'alignTop' },
  { value: 'middle', icon: TextValignMiddleIcon, label: 'alignMiddle' },
  { value: 'bottom', icon: TextValignBottomIcon, label: 'alignBottom' },
] as const

// what the cell does without a style: numbers right, text left, and the middle
const align = computed(() => style.value.align ?? alignOf(sheet.value(active.value)))
const valign = computed(() => style.value.valign ?? 'middle')
const valignIcon = computed(() => VALIGN.find((v) => v.value === valign.value)!.icon)

function setAlign(value: ToggleValue | ToggleValue[] | null) {
  if (typeof value !== 'string') return
  sheet.styleSelection({ align: value as SheetStyle['align'] })
  done()
}
function setValign(value: SheetStyle['valign']) {
  sheet.styleSelection({ valign: value === 'middle' ? undefined : value })
  done()
}

// Conditional formats ---------------------------------------------------------------------

/** The selected ranges, as names such as `D2:D40`. */
function selectedRanges() {
  const data = sheet.sheet.value
  const size = { rows: data.rowCount ?? 1000, cols: data.colCount ?? 26 }
  return sheet.selection.value.ranges.map((range) => formatRange(range, size))
}
/** The range the active cell is in, which a new format starts with. */
function activeRange() {
  const { ranges } = sheet.selection.value
  const { row, col } = active.value
  const range =
    ranges.find((r) => {
      const b = boundsOf(r)
      return row >= b.top && row <= b.bottom && col >= b.left && col <= b.right
    }) ?? ranges[ranges.length - 1]
  const data = sheet.sheet.value
  return range ? formatRange(range, { rows: data.rowCount ?? 1000, cols: data.colCount ?? 26 }) : ''
}

function addFormats(list: SheetConditionalFormat[]) {
  if (!list.length) return
  sheet.transact(
    (tr) => {
      for (const f of list) tr.addConditionalFormat(f)
    },
    { action: 'format' },
  )
  sheet.announce(format(m.value.formats.added, { range: list.map((f) => f.range).join(', ') }))
  done()
}

/** The menu items that open the dialog, and the rule each starts with. */
const HIGHLIGHTS = ['gt', 'lt', 'between', 'eq', 'contains', 'duplicates', 'formula'] as const
const RANKS = ['top', 'bottom', 'above', 'below'] as const
type FormatItem = (typeof HIGHLIGHTS)[number] | (typeof RANKS)[number]
function startOf(item: FormatItem, range: string): SheetConditionalFormat {
  const look = { ...LOOKS.danger }
  switch (item) {
    case 'duplicates':
      return { range, duplicates: true, style: look }
    case 'formula':
      return { range, formula: '', style: look }
    case 'top':
      return { range, top: 10, style: look }
    case 'bottom':
      return { range, bottom: 10, style: look }
    case 'above':
    case 'below':
      return { range, average: item, style: look }
    default:
      return { range, when: { op: item }, style: look }
  }
}

const dialogFormat = ref<SheetConditionalFormat>({ range: '', when: { op: 'gt' }, style: {} })
const dialogTitle = ref('')
const dialogOpen = ref(false)
/** The rule being edited, by its place in the list; `-1` adds one. */
const editing = ref(-1)
function openFormat(item: FormatItem) {
  dialogFormat.value = startOf(item, activeRange())
  dialogTitle.value = m.value.formats[item].replace(/…$/, '')
  editing.value = -1
  dialogOpen.value = true
}
function editFormat(index: number) {
  dialogFormat.value = conditionals.value[index]!
  dialogTitle.value = m.value.formats.editTitle
  editing.value = index
  dialogOpen.value = true
}
function applyFormat(f: SheetConditionalFormat) {
  if (editing.value < 0) return addFormats([f])
  const list = [...conditionals.value]
  list[editing.value] = f
  setFormats(list)
}
function dialogClosed() {
  // editing from the list goes back to it, which keeps the focus
  if (!listOpen.value) sheet.focus()
}
// Data validation --------------------------------------------------------------------------

const validations = computed(() => sheet.sheet.value.validations ?? [])
const ruleOpen = ref(false)
const rule = ref<SheetValidation>({ range: '', list: [] })
/** The rule being edited, by its place in the sheet's; `-1` adds one. */
const ruleIndex = ref(-1)
/** Opens the rule of the active cell, or a new one for the selection. */
function openValidation() {
  const { row, col } = active.value
  ruleIndex.value = validations.value.findIndex((r) => {
    const range = parseRange(r.range)
    return !!range && inBounds(boundsOf(range), row, col)
  })
  rule.value =
    ruleIndex.value >= 0 ? validations.value[ruleIndex.value]! : { range: activeRange(), list: [] }
  ruleOpen.value = true
}
function applyValidation(next: SheetValidation) {
  const list = [...validations.value]
  if (ruleIndex.value >= 0) list[ruleIndex.value] = next
  else list.push(next)
  sheet.transact((tr) => tr.setValidations(list), { action: 'validation' })
  sheet.announce(format(m.value.validation.added, { range: next.range }))
}
function removeValidation() {
  const gone = validations.value[ruleIndex.value]
  if (!gone) return
  sheet.transact((tr) => tr.setValidations(validations.value.filter((r) => r !== gone)), {
    action: 'validation',
  })
  sheet.announce(format(m.value.validation.removed, { range: gone.range }))
}

const listOpen = ref(false)
const conditionals = computed(() => sheet.sheet.value.conditionalFormats ?? [])
function setFormats(next: SheetConditionalFormat[]) {
  sheet.transact((tr) => tr.setConditionalFormats(next), { action: 'format' })
}
function clearFormats(all: boolean) {
  const before = conditionals.value.length
  sheet.transact(
    (tr) => {
      if (all) tr.clearConditionalFormats()
      else for (const range of selectedRanges()) tr.clearConditionalFormats(range)
    },
    { action: 'format' },
  )
  const count = before - (sheet.sheet.value.conditionalFormats?.length ?? 0)
  sheet.announce(format(m.value.formats.cleared, { count }))
  done()
}

function addScale(colors: SheetScaleColors) {
  addFormats(selectedRanges().map((range) => ({ range, scale: [...colors] as SheetScaleColors })))
}
function addBar(tone: Tone) {
  addFormats(selectedRanges().map((range) => ({ range, bar: tone })))
}

// Merge and freeze ------------------------------------------------------------------------

function toggleMerge() {
  if (sheet.merged.value) sheet.unmerge()
  else sheet.merge()
  done()
}

const freeze = computed(() => sheet.sheet.value.freeze ?? {})
function setFreeze(rows: number, cols: number) {
  sheet.transact(
    (tr) =>
      tr.updateSheet({
        freeze: rows || cols ? { rows: rows || undefined, cols: cols || undefined } : undefined,
      }),
    { action: 'freeze' },
  )
  done()
}
const freezeItems = computed(() => {
  const { row, col } = active.value
  const f = freeze.value
  const items = [
    { key: 'row1', label: m.value.freezeFirstRow, rows: 1, cols: f.cols ?? 0 },
    { key: 'col1', label: m.value.freezeFirstCol, rows: f.rows ?? 0, cols: 1 },
  ]
  if (row > 0)
    items.push({
      key: 'rows',
      label: format(m.value.freezeRows, { n: row + 1 }),
      rows: row + 1,
      cols: f.cols ?? 0,
    })
  if (col > 0)
    items.push({
      key: 'cols',
      label: format(m.value.freezeCols, { col: columnName(col) }),
      rows: f.rows ?? 0,
      cols: col + 1,
    })
  return items
})
const frozen = computed(() => !!(freeze.value.rows || freeze.value.cols))

function clear() {
  if (sheet.clearFormatting()) sheet.announce(m.value.formattingCleared)
  done()
}

// Too narrow for every tool: one row that scrolls sideways, faded at the side with more

const bar = useTemplateRef<InstanceType<typeof DouToolbar>>('bar')
const barEl = computed(() => (bar.value?.$el as HTMLElement | undefined) ?? null)
const more = ref({ start: false, end: false })
function measure() {
  const el = barEl.value
  if (!el) return
  const start = el.scrollLeft > 1
  const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
  if (start !== more.value.start || end !== more.value.end) more.value = { start, end }
}
let observer: ResizeObserver | undefined
watch(
  barEl,
  (el) => {
    observer?.disconnect()
    if (!el || typeof ResizeObserver === 'undefined') return
    observer = new ResizeObserver(measure)
    observer.observe(el)
  },
  { flush: 'post' },
)
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="dou-sheet-toolbar">
    <DouToolbar
      ref="bar"
      size="sm"
      class="dou-sheet-toolbar__bar"
      :class="{ 'has-more-start': more.start, 'has-more-end': more.end }"
      :aria-label="m.toolbar"
      @pointerdown="onPointerDown"
      @keydown="onKeyDown"
      @scroll.passive="measure"
    >
      <slot name="start" />
      <template v-for="(tool, i) in tools" :key="tool === '|' ? `|${i}` : tool">
        <DouToolbarSeparator v-if="tool === '|'" />

        <template v-else-if="tool === 'undo' || tool === 'redo'">
          <DouTooltip
            :content="m[tool]"
            :shortcut="tool === 'undo' ? 'mod+z' : 'mod+shift+z'"
            placement="bottom"
          >
            <DouButton
              variant="ghost"
              :aria-label="m[tool]"
              :disabled="disabled || !(tool === 'undo' ? sheet.canUndo.value : sheet.canRedo.value)"
              @click="(tool === 'undo' ? sheet.undo() : sheet.redo(), done())"
            >
              <UndoIcon v-if="tool === 'undo'" />
              <RedoIcon v-else />
            </DouButton>
          </DouTooltip>
        </template>

        <DouDropdown
          v-else-if="tool === 'format'"
          :open="menuOpen === tool"
          placement="bottom-start"
          :disabled="disabled"
          @update:open="onMenu(tool, $event)"
        >
          <DouButton
            variant="ghost"
            class="dou-sheet-toolbar__format"
            :aria-label="`${m.numberFormat}：${formatLabel}`"
          >
            <span class="dou-sheet-toolbar__format-label">{{ formatLabel }}</span>
            <template #trailing><ChevronDownIcon /></template>
          </DouButton>
          <template #menu>
            <DouDropdownItem
              v-for="option in formats"
              :key="option.label"
              class="dou-sheet-toolbar__format-item"
              @click="setFormat(option)"
            >
              <span class="dou-sheet-toolbar__check">
                <CheckIcon v-if="option === formatShown" />
              </span>
              {{ option.label }}
              <template #suffix>
                <span class="dou-sheet-toolbar__example">{{ exampleOf(option) }}</span>
              </template>
            </DouDropdownItem>
          </template>
        </DouDropdown>

        <template v-else-if="tool === 'decimals'">
          <DouTooltip
            v-for="by in [-1, 1]"
            :key="by"
            :content="by < 0 ? m.fewerDecimals : m.moreDecimals"
            placement="bottom"
          >
            <DouButton
              variant="ghost"
              :aria-label="by < 0 ? m.fewerDecimals : m.moreDecimals"
              :disabled="disabled"
              @click="decimals(by)"
            >
              <DecimalDecreaseIcon v-if="by < 0" />
              <DecimalIncreaseIcon v-else />
            </DouButton>
          </DouTooltip>
        </template>

        <DouTooltip
          v-else-if="isStyleTool(tool)"
          :content="m[tool]"
          :shortcut="STYLE[tool].key"
          placement="bottom"
        >
          <DouToggle
            :pressed="!!style[tool]"
            :aria-label="m[tool]"
            :disabled="disabled"
            @update:pressed="toggle(tool, $event)"
          >
            <component :is="STYLE[tool].icon" />
          </DouToggle>
        </DouTooltip>

        <DouTooltip
          v-else-if="tool === 'color' || tool === 'fill'"
          :content="tool === 'color' ? m.textColor : m.fillColor"
          :disabled="colorOpen === tool"
          placement="bottom"
        >
          <span class="dou-sheet-toolbar__trigger">
            <DouPopover
              :open="colorOpen === tool"
              placement="bottom-start"
              :disabled="disabled"
              @update:open="colorOpen = $event ? tool : colorOpen === tool ? null : colorOpen"
            >
              <DouButton
                variant="ghost"
                class="dou-sheet-toolbar__color"
                :class="`is-${tool}`"
                :style="{ '--dou-sheet-swatch': swatchOf(tool) }"
                :aria-label="tool === 'color' ? m.textColor : m.fillColor"
                :aria-expanded="colorOpen === tool"
              >
                <BaselineIcon v-if="tool === 'color'" />
                <PaintBucketIcon v-else />
              </DouButton>
              <template #content>
                <div
                  class="dou-sheet-toolbar__colors"
                  :aria-label="tool === 'color' ? m.textColor : m.fillColor"
                  role="group"
                >
                  <button
                    type="button"
                    class="dou-sheet-toolbar__swatch is-default"
                    :class="`is-${tool}`"
                    :aria-pressed="!colorOf(tool).tone && !colorOf(tool).css"
                    :aria-label="m.colorDefault"
                    :title="m.colorDefault"
                    @click="setColor(tool, {})"
                  />
                  <button
                    v-for="tone in TONES"
                    :key="tone"
                    type="button"
                    class="dou-sheet-toolbar__swatch"
                    :class="[`is-${tool}`, `is-tone-${tone}`]"
                    :aria-pressed="colorOf(tool).tone === tone"
                    :aria-label="toneLabel(tone)"
                    :title="toneLabel(tone)"
                    @click="setColor(tool, { tone })"
                  >
                    <span v-if="tool === 'color'" aria-hidden="true">A</span>
                  </button>
                  <button
                    type="button"
                    class="dou-sheet-toolbar__swatch is-custom"
                    :class="`is-${tool}`"
                    :aria-pressed="!!colorOf(tool).css"
                    :aria-expanded="custom === tool"
                    :aria-label="m.colorCustom"
                    :title="m.colorCustom"
                    :style="{ '--dou-sheet-swatch': colorOf(tool).css }"
                    @click="openCustom(tool, $event)"
                  >
                    <span v-if="colorOf(tool).css && tool === 'color'" aria-hidden="true">A</span>
                    <PaletteIcon v-else-if="!colorOf(tool).css" />
                  </button>
                </div>
                <DouColorPanel
                  v-if="custom === tool"
                  v-model="customColor"
                  class="dou-sheet-toolbar__panel"
                  :bordered="false"
                  format="hex"
                  show-input
                  @change="$event && setColor(tool, { css: $event }, false)"
                />
              </template>
            </DouPopover>
          </span>
        </DouTooltip>

        <DouToggleGroup
          v-else-if="tool === 'align'"
          type="single"
          :model-value="align"
          :disabled="disabled"
          @update:model-value="setAlign"
        >
          <DouTooltip v-for="a in ALIGN" :key="a.value" :content="m[a.label]" placement="bottom">
            <DouToggle :value="a.value" :aria-label="m[a.label]">
              <component :is="a.icon" />
            </DouToggle>
          </DouTooltip>
        </DouToggleGroup>

        <DouTooltip
          v-else-if="tool === 'valign'"
          :content="m.verticalAlign"
          :disabled="menuOpen === tool"
          placement="bottom"
        >
          <span class="dou-sheet-toolbar__trigger">
            <DouDropdown
              :open="menuOpen === tool"
              placement="bottom-start"
              :disabled="disabled"
              @update:open="onMenu(tool, $event)"
            >
              <DouButton
                variant="ghost"
                class="dou-sheet-toolbar__menu"
                :aria-label="m.verticalAlign"
              >
                <component :is="valignIcon" />
                <template #trailing><ChevronDownIcon /></template>
              </DouButton>
              <template #menu>
                <DouDropdownItem v-for="v in VALIGN" :key="v.value" @click="setValign(v.value)">
                  <template #prefix><component :is="v.icon" /></template>
                  {{ m[v.label] }}
                  <template v-if="v.value === valign" #suffix><CheckIcon /></template>
                </DouDropdownItem>
              </template>
            </DouDropdown>
          </span>
        </DouTooltip>

        <DouTooltip v-else-if="tool === 'wrap'" :content="m.wrap" placement="bottom">
          <DouToggle
            :pressed="!!style.wrap"
            :aria-label="m.wrap"
            :disabled="disabled"
            @update:pressed="(sheet.styleSelection({ wrap: $event || undefined }), done())"
          >
            <WrapTextIcon />
          </DouToggle>
        </DouTooltip>

        <DouTooltip
          v-else-if="tool === 'merge'"
          :content="sheet.merged.value ? m.unmergeCells : m.mergeCells"
          placement="bottom"
        >
          <DouToggle
            :pressed="sheet.merged.value"
            :aria-label="m.mergeCells"
            :disabled="disabled || (!sheet.merged.value && !sheet.canMerge.value)"
            @update:pressed="toggleMerge"
          >
            <CellsMergeIcon />
          </DouToggle>
        </DouTooltip>

        <DouTooltip
          v-else-if="tool === 'freeze'"
          :content="m.freeze"
          :disabled="menuOpen === tool"
          placement="bottom"
        >
          <span class="dou-sheet-toolbar__trigger">
            <DouDropdown
              :open="menuOpen === tool"
              placement="bottom-start"
              :disabled="disabled"
              @update:open="onMenu(tool, $event)"
            >
              <DouButton
                variant="ghost"
                class="dou-sheet-toolbar__menu"
                :class="{ 'is-on': frozen }"
                :aria-label="m.freeze"
              >
                <TableFreezeIcon />
                <template #trailing><ChevronDownIcon /></template>
              </DouButton>
              <template #menu>
                <DouDropdownItem
                  v-for="item in freezeItems"
                  :key="item.key"
                  @click="setFreeze(item.rows, item.cols)"
                >
                  {{ item.label }}
                  <template
                    v-if="(freeze.rows ?? 0) === item.rows && (freeze.cols ?? 0) === item.cols"
                    #suffix
                    ><CheckIcon
                  /></template>
                </DouDropdownItem>
                <DouDropdownItem divided :disabled="!frozen" @click="setFreeze(0, 0)">
                  {{ m.unfreeze }}
                </DouDropdownItem>
              </template>
            </DouDropdown>
          </span>
        </DouTooltip>

        <DouTooltip
          v-else-if="tool === 'sort'"
          :content="m.filter.sort"
          :disabled="menuOpen === tool"
          placement="bottom"
        >
          <span class="dou-sheet-toolbar__trigger">
            <DouDropdown
              :open="menuOpen === tool"
              placement="bottom-start"
              :disabled="disabled"
              @update:open="onMenu(tool, $event)"
            >
              <DouButton
                variant="ghost"
                class="dou-sheet-toolbar__menu"
                :aria-label="m.filter.sort"
              >
                <SortIcon />
                <template #trailing><ChevronDownIcon /></template>
              </DouButton>
              <template #menu>
                <DouDropdownItem @click="sheet.sort('asc')">
                  <template #prefix><SortAscendingIcon /></template>
                  {{ m.filter.sortAsc }}
                </DouDropdownItem>
                <DouDropdownItem @click="sheet.sort('desc')">
                  <template #prefix><SortDescendingIcon /></template>
                  {{ m.filter.sortDesc }}
                </DouDropdownItem>
              </template>
            </DouDropdown>
          </span>
        </DouTooltip>

        <DouTooltip
          v-else-if="tool === 'filter'"
          :content="sheet.filtered.value ? m.filter.turnOff : m.filter.turnOn"
          placement="bottom"
        >
          <DouToggle
            :pressed="sheet.filtered.value"
            :aria-label="m.filter.turnOn"
            :disabled="disabled"
            @update:pressed="(sheet.toggleFilter(), done())"
          >
            <FilterIcon />
          </DouToggle>
        </DouTooltip>

        <DouTooltip
          v-else-if="tool === 'conditional'"
          :content="m.formats.title"
          :disabled="menuOpen === tool"
          placement="bottom"
        >
          <span class="dou-sheet-toolbar__trigger">
            <DouDropdown
              :open="menuOpen === tool"
              placement="bottom-start"
              :disabled="disabled"
              @update:open="onMenu(tool, $event)"
            >
              <DouButton
                variant="ghost"
                class="dou-sheet-toolbar__menu"
                :aria-label="m.formats.title"
              >
                <TableHighlightIcon />
                <template #trailing><ChevronDownIcon /></template>
              </DouButton>
              <template #menu>
                <DouDropdownSub :title="m.formats.highlight">
                  <DouDropdownItem v-for="kind in HIGHLIGHTS" :key="kind" @click="openFormat(kind)">
                    {{ m.formats[kind] }}
                  </DouDropdownItem>
                </DouDropdownSub>
                <DouDropdownSub :title="m.formats.ranks">
                  <DouDropdownItem v-for="kind in RANKS" :key="kind" @click="openFormat(kind)">
                    {{ m.formats[kind] }}
                  </DouDropdownItem>
                </DouDropdownSub>
                <DouDropdownSub :title="m.formats.bar">
                  <DouDropdownItem v-for="tone in TONES" :key="tone" @click="addBar(tone)">
                    <template #prefix>
                      <span
                        class="dou-sheet-toolbar__gradient"
                        :style="{ backgroundImage: barSwatch(tone) }"
                      />
                    </template>
                    {{ toneLabel(tone) }}
                  </DouDropdownItem>
                </DouDropdownSub>
                <DouDropdownSub :title="m.formats.scale">
                  <DouDropdownItem
                    v-for="(colors, key) in SCALES"
                    :key="key"
                    @click="addScale(colors)"
                  >
                    <template #prefix>
                      <span
                        class="dou-sheet-toolbar__gradient"
                        :style="{ backgroundImage: scaleSwatch(colors) }"
                      />
                    </template>
                    {{ m.formats.scales[key] }}
                  </DouDropdownItem>
                </DouDropdownSub>
                <DouDropdownItem divided @click="clearFormats(false)">
                  {{ m.formats.clearSelection }}
                </DouDropdownItem>
                <DouDropdownItem :disabled="!conditionals.length" @click="clearFormats(true)">
                  {{ m.formats.clearSheet }}
                </DouDropdownItem>
                <DouDropdownItem divided @click="listOpen = true">
                  {{ m.formats.manage }}
                </DouDropdownItem>
              </template>
            </DouDropdown>
          </span>
        </DouTooltip>

        <DouTooltip
          v-else-if="tool === 'validation'"
          :content="m.validation.title"
          placement="bottom"
        >
          <DouButton
            variant="ghost"
            :aria-label="m.validation.title"
            aria-haspopup="dialog"
            :disabled="disabled"
            @click="openValidation"
          >
            <TableCheckIcon />
          </DouButton>
        </DouTooltip>

        <DouTooltip
          v-else-if="tool === 'clear'"
          :content="m.clearFormatting"
          shortcut="mod+\"
          placement="bottom"
        >
          <DouButton
            variant="ghost"
            :aria-label="m.clearFormatting"
            :disabled="disabled"
            @click="clear"
          >
            <TypeXIcon />
          </DouButton>
        </DouTooltip>
      </template>
      <slot name="end" />
    </DouToolbar>
    <FormatDialog
      v-model:open="dialogOpen"
      :format="dialogFormat"
      :title="dialogTitle"
      :styles="sheet.doc.value.styles"
      :messages="m"
      @apply="applyFormat"
      @closed="dialogClosed"
    />
    <ValidationDialog
      v-model:open="ruleOpen"
      :rule="rule"
      :editing="ruleIndex >= 0"
      :messages="m"
      @apply="applyValidation"
      @remove="removeValidation"
      @closed="sheet.focus()"
    />
    <FormatList
      v-model:open="listOpen"
      :formats="conditionals"
      :styles="sheet.doc.value.styles"
      :messages="m"
      @change="setFormats"
      @edit="editFormat"
      @closed="sheet.focus()"
    />
  </div>
</template>
