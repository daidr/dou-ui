<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useSheet } from '../context'
import { formatCell, parseRange, splitSheet } from '../core/address'
import { format } from '../locale'

/** The formula bar's name box: the active cell's name, or a cell or range to go to. */
defineOptions({ name: 'DouSheetNameBox' })

const sheet = useSheet()
const { editor, messages: m } = sheet
const nameInput = useTemplateRef<HTMLInputElement>('name')

const nameTyping = ref<string | null>(null)
/** Whether the text in the name box is no cell or range; it stays there to fix, or Escape. */
const nameInvalid = ref(false)
const cellName = computed(() => {
  const e = editor.cell.value
  return formatCell(e ?? sheet.active.value)
})
const nameText = computed(() => nameTyping.value ?? cellName.value)

function goTo() {
  const text = (nameTyping.value ?? '').trim()
  if (!text) {
    nameTyping.value = null
    return sheet.focus()
  }
  const { sheet: name, ref: target } = splitSheet(text)
  const range = parseRange(target)
  const at =
    name == null
      ? sheet.sheetIndex.value
      : sheet.doc.value.sheets.findIndex((s) => s.name.toLowerCase() === name.toLowerCase())
  if (!range || at === -1) {
    nameInvalid.value = true
    sheet.announce(format(m.value.badAddress, { text }))
    nameInput.value?.select()
    return
  }
  nameTyping.value = null
  nameInvalid.value = false
  if (at !== sheet.sheetIndex.value) sheet.showSheet(at)
  void nextTick(() => {
    sheet.select(target)
    sheet.focus()
  })
}

function onNameInput(event: Event) {
  nameTyping.value = (event.target as HTMLInputElement).value
  nameInvalid.value = false
}

/** Leaving the box shows the active cell again. */
function onNameBlur() {
  nameTyping.value = null
  nameInvalid.value = false
}

function onNameKey(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Enter') {
    event.preventDefault()
    goTo()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    nameTyping.value = null
    nameInvalid.value = false
    sheet.focus()
  }
}
</script>

<template>
  <input
    ref="name"
    class="dou-sheet-formula-bar__name"
    :value="nameText"
    :class="{ 'is-invalid': nameInvalid }"
    :aria-label="m.nameBox"
    :aria-invalid="nameInvalid || undefined"
    autocomplete="off"
    autocapitalize="off"
    spellcheck="false"
    @focus="($event.target as HTMLInputElement).select()"
    @input="onNameInput"
    @keydown="onNameKey"
    @blur="onNameBlur"
  />
</template>
