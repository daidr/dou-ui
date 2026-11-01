<script setup lang="ts">
import { FunctionIcon } from '@dou-ui/icons'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useSheet } from '../context'
import SheetNameBox from './sheet-name-box.vue'
import { formulaReferences } from '../formula/edit'

defineOptions({ name: 'DouSheetFormulaBar' })

const sheet = useSheet()
const { editor, messages: m } = sheet

const input = useTemplateRef<HTMLTextAreaElement>('input')
const mirror = useTemplateRef<HTMLElement>('mirror')

// The formula box: what the active cell holds, edited along with the cell ----------------------

const editingHere = computed(() => !!editor.cell.value)
const text = computed(() =>
  editingHere.value ? editor.text.value : editor.textAt(sheet.active.value),
)
const marks = computed(() => (editingHere.value ? formulaReferences(text.value) : []))
const parts = computed(() => {
  const value = text.value
  const out: { text: string; color?: number }[] = []
  let at = 0
  for (const mark of marks.value) {
    if (mark.start > at) out.push({ text: value.slice(at, mark.start) })
    out.push({ text: mark.text, color: mark.color })
    at = mark.end
  }
  out.push({ text: `${value.slice(at)}​` })
  return out
})

/** As many lines as the text has, up to five; more scroll. */
const lines = computed(() => Math.min(5, text.value.split('\n').length))

let composing = false
const setComposing = (value: boolean) => (composing = value)

function onInput(event: Event) {
  const el = event.target as HTMLTextAreaElement
  if (!editor.input(el.value, el.selectionStart)) el.value = text.value
  syncMirror()
}

function onKey(event: KeyboardEvent) {
  if (composing || event.isComposing) return
  if (editingHere.value) {
    // Enter, Tab and Escape finish the edit as in the cell; completion and pointing too
    if (editor.key(event) && !editor.cell.value) sheet.focus()
    return
  }
  if (event.key === 'Escape' || event.key === 'Enter') {
    event.preventDefault()
    sheet.focus()
  }
}

function syncCaret() {
  const el = input.value
  if (el && editingHere.value) editor.moveCaret(el.selectionStart)
  syncMirror()
}

function syncMirror() {
  const el = input.value
  const shown = mirror.value
  if (!el || !shown) return
  shown.scrollLeft = el.scrollLeft
  shown.scrollTop = el.scrollTop
}

function onBlur(event: FocusEvent) {
  // a press on a cell finished the edit already; going elsewhere saves it, as leaving the cell does
  const next = event.relatedTarget as Element | null
  if (!editor.cell.value || !document.hasFocus()) return
  if (next?.closest('.dou-sheet__input, .dou-sheet__assist')) return
  editor.commit()
}

watch(text, () => void nextTick(syncMirror))

let detach: (() => void) | undefined
onMounted(() => {
  if (input.value) detach = editor.attach(input.value)
})
onBeforeUnmount(() => detach?.())
</script>

<template>
  <div class="dou-sheet-formula-bar">
    <SheetNameBox />
    <span class="dou-sheet-formula-bar__mark" aria-hidden="true"><FunctionIcon /></span>
    <div class="dou-sheet-formula-bar__box" :style="`--dou-sheet-bar-lines:${lines}`">
      <div
        v-if="marks.length"
        ref="mirror"
        class="dou-sheet-formula-bar__mirror"
        aria-hidden="true"
      >
        <span
          v-for="(part, i) in parts"
          :key="i"
          :class="part.color != null && `is-ref-${part.color}`"
          >{{ part.text }}</span
        >
      </div>
      <textarea
        ref="input"
        class="dou-sheet-formula-bar__input"
        :class="{ 'is-formula': marks.length > 0 }"
        :value="text"
        :aria-label="m.formulaBox"
        :aria-autocomplete="editingHere ? 'list' : undefined"
        :aria-controls="editingHere ? editor.helpId : undefined"
        :readonly="sheet.readonly.value"
        rows="1"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        @input="onInput"
        @keydown="onKey"
        @keyup="syncCaret"
        @click="syncCaret"
        @select="syncCaret"
        @scroll="syncMirror"
        @compositionstart="setComposing(true)"
        @compositionend="setComposing(false)"
        @blur="onBlur"
      />
    </div>
  </div>
</template>
