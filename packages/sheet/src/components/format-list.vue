<script setup lang="ts">
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, TrashIcon } from '@dou-ui/icons'
import { DouButton, DouDialog, DouTooltip } from 'dou-ui'
import { computed, useId } from 'vue'
import type { SheetConditionalFormat, SheetStyle, SheetValue } from '../core/model'
import { format, type SheetMessages } from '../locale'
import { formatSample } from './format-presets'

/*
 * The conditional formats of the sheet shown, in the order they apply:
 * what each checks, its cells and how they look, to edit, reorder or delete.
 */

const props = defineProps<{
  formats: readonly SheetConditionalFormat[]
  /** The workbook's named styles, for formats that name one. */
  styles: Record<string, SheetStyle> | undefined
  messages: SheetMessages
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{
  change: [formats: SheetConditionalFormat[]]
  /** Asks to edit the format at `index`. */
  edit: [index: number]
  closed: []
}>()

const m = computed(() => props.messages.formats)
const uid = useId()

const text = (value: SheetValue | undefined) =>
  typeof value === 'string' ? `“${value}”` : String(value ?? '')

/** What a format checks, in words. */
function describe(f: SheetConditionalFormat) {
  const d = m.value.describe
  if ('when' in f) {
    const { op, value, to } = f.when
    const between = op === 'between' || op === 'notBetween'
    return format(between ? d.between : d.when, {
      op: props.messages.ops[op],
      value: text(value),
      to: text(to),
    }).trim()
  }
  if ('formula' in f) return format(d.formula, { formula: f.formula })
  if ('top' in f && f.top != null) return format(f.percent ? d.topPercent : d.top, { count: f.top })
  if ('bottom' in f && f.bottom != null)
    return format(f.percent ? d.bottomPercent : d.bottom, { count: f.bottom })
  if ('average' in f) return f.average === 'above' ? d.above : d.below
  if ('duplicates' in f) return d.repeated
  if ('unique' in f) return d.unique
  if ('scale' in f) return d.scale
  return d.bar
}

const sample = (f: SheetConditionalFormat) => formatSample(f, props.styles)

function move(index: number, by: number) {
  const list = [...props.formats]
  const [item] = list.splice(index, 1)
  list.splice(index + by, 0, item!)
  emit('change', list)
}
function remove(index: number) {
  emit(
    'change',
    props.formats.filter((_, i) => i !== index),
  )
}
</script>

<template>
  <DouDialog v-model:open="open" :title="m.title" :width="520" @closed="emit('closed')">
    <p v-if="!formats.length" class="dou-sheet-formats__empty">{{ m.empty }}</p>
    <ol v-else class="dou-sheet-formats">
      <li v-for="(f, i) in formats" :key="i" class="dou-sheet-formats__item">
        <span
          class="dou-sheet-format__sample"
          :class="sample(f).cls"
          :style="sample(f).css"
          aria-hidden="true"
          >123</span
        >
        <span class="dou-sheet-formats__what">
          <span :id="`${uid}-${i}`" class="dou-sheet-formats__rule">{{ describe(f) }}</span>
          <span class="dou-sheet-formats__range">{{ f.range }}</span>
        </span>
        <span class="dou-sheet-formats__actions">
          <DouTooltip :content="m.edit">
            <DouButton
              variant="ghost"
              size="sm"
              :aria-label="m.edit"
              :aria-describedby="`${uid}-${i}`"
              @click="emit('edit', i)"
            >
              <PencilIcon />
            </DouButton>
          </DouTooltip>
          <DouTooltip :content="m.moveUp">
            <DouButton
              variant="ghost"
              size="sm"
              :aria-label="m.moveUp"
              :aria-describedby="`${uid}-${i}`"
              :disabled="i === 0"
              @click="move(i, -1)"
            >
              <ArrowUpIcon />
            </DouButton>
          </DouTooltip>
          <DouTooltip :content="m.moveDown">
            <DouButton
              variant="ghost"
              size="sm"
              :aria-label="m.moveDown"
              :aria-describedby="`${uid}-${i}`"
              :disabled="i === formats.length - 1"
              @click="move(i, 1)"
            >
              <ArrowDownIcon />
            </DouButton>
          </DouTooltip>
          <DouTooltip :content="m.remove">
            <DouButton
              variant="ghost"
              size="sm"
              :aria-label="m.remove"
              :aria-describedby="`${uid}-${i}`"
              @click="remove(i)"
            >
              <TrashIcon />
            </DouButton>
          </DouTooltip>
        </span>
      </li>
    </ol>
    <template #footer="{ close }">
      <DouButton variant="outline" @click="close">{{ m.close }}</DouButton>
    </template>
  </DouDialog>
</template>
