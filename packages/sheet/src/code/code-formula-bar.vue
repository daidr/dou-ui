<script setup lang="ts">
import {
  DouCodeInput,
  defineCodeExtension,
  type CodeDecoration,
  type CodeDiagnostic,
  type CodeEditorExpose,
  type CodeTransactionResult,
} from '@dou-ui/code'
import { FunctionIcon } from '@dou-ui/icons'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch,
  watchEffect,
} from 'vue'
import SheetNameBox from '../components/sheet-name-box.vue'
import { useSheet } from '../context'
import { formulaReferences } from '../formula/edit'
import { formulaTokens, parseFormula, SheetFormulaSyntaxError } from '../formula/parse'
import { format } from '../locale'
import { sheetFormula } from './language'

/**
 * The formula bar, with the formula in `@dou-ui/code`'s code input:
 * colored as it is typed, brackets matched, and mistakes underlined. It
 * edits the cell the way the built-in bar does, with the same function
 * list, argument hints and pointing at cells.
 */
defineOptions({ name: 'DouSheetCodeFormulaBar' })

const sheet = useSheet()
const { editor, messages: m } = sheet

const root = useTemplateRef<HTMLElement>('root')
const input = shallowRef<CodeEditorExpose>()

const editingHere = computed(() => !!editor.cell.value)
const text = computed(() =>
  editingHere.value ? editor.text.value : editor.textAt(sheet.active.value),
)
const isFormula = computed(() => text.value.startsWith('='))

/** Each reference in the color it has on the cells. */
const references = computed(() => (editingHere.value ? formulaReferences(text.value) : []))

const functionNames = computed(() => new Set(editor.functions.value.map((f) => f.name)))

/** Text that can't be read as a formula, and functions there are none of. */
function lint(doc: string): CodeDiagnostic[] {
  if (!doc.startsWith('=') || doc.trim() === '=') return []
  const out: CodeDiagnostic[] = []
  try {
    parseFormula(doc)
  } catch (error) {
    if (!(error instanceof SheetFormulaSyntaxError)) throw error
    const at = Math.min(doc.length, error.at + 1)
    out.push({
      from: at,
      to: Math.min(doc.length, at + 1),
      severity: 'error',
      message: m.value.formulaSyntax,
    })
  }
  const tokens = formulaTokens(doc)
  for (const [i, token] of tokens.entries()) {
    const next = tokens[i + 1]
    if (token.kind !== 'name' || next?.text !== '(') continue
    if (functionNames.value.has(token.text.toUpperCase())) continue
    out.push({
      from: token.start,
      to: token.end,
      severity: 'warning',
      message: format(m.value.unknownFunction, {
        name: token.text.toUpperCase(),
      }),
    })
  }
  return out
}

const extension = defineCodeExtension({
  name: 'sheet-formula',
  decorations: (): CodeDecoration[] =>
    references.value.map((ref) => ({
      type: 'mark',
      from: ref.start,
      to: ref.end,
      class: `dou-sheet-code-bar__ref is-ref-${ref.color}`,
    })),
  lint: (ctx) => lint(ctx.doc.toString()),
})
const extensions = [extension]

// ---------------------------------------------------------------- the cell's edit, both ways

/** Set while the cell's text is written into the box, so it isn't sent back. */
let syncing = false

function onTransaction(result: CodeTransactionResult) {
  if (syncing || sheet.readonly.value) return
  const head = result.state.selection.ranges[result.state.selection.main]!.head
  if (!result.changes.empty) {
    const value = result.state.doc.toString()
    if (!editor.input(value, head)) {
      // the cell can't be edited: back to what it holds
      writeBox(text.value, editor.caret.value)
    }
  } else if (editingHere.value) editor.moveCaret(head)
}

/** Puts the cell's text and caret in the box, unless they are there already. */
function writeBox(value: string, caret: number) {
  const box = input.value
  if (!box) return
  syncing = true
  try {
    if (box.doc.toString() !== value)
      box.transact((tr) => tr.replace(0, tr.doc.length, value), {
        action: 'external',
        history: false,
      })
    const main = box.selection.ranges[box.selection.main]!
    if (editingHere.value && (main.head !== caret || main.anchor !== caret))
      box.select(Math.min(caret, value.length))
  } finally {
    syncing = false
  }
}

// pointing at cells, Tab completing a name: the cell's edit moves, the box follows
watch([text, () => editor.caret.value], ([value, caret]) => writeBox(value, caret), {
  flush: 'sync',
})

// Enter, Tab, Escape, the function list and pointing work as in the cell: before the box's own keys
function onKey(event: KeyboardEvent) {
  if (event.isComposing) return
  if (editingHere.value) {
    // a new line in the formula, as Alt + Enter does in the cell
    if (event.key === 'Enter' && event.altKey) {
      event.preventDefault()
      event.stopPropagation()
      input.value?.transact((tr) => tr.replaceSelection('\n'), {
        action: 'input',
        scroll: true,
      })
      return
    }
    if (editor.key(event)) {
      event.stopPropagation()
      if (!editor.cell.value) sheet.focus()
    }
    return
  }
  if (event.key === 'Escape' || event.key === 'Enter') {
    event.preventDefault()
    event.stopPropagation()
    sheet.focus()
  }
}

function onBlur(event: FocusEvent) {
  // a press on a cell finished the edit already; going elsewhere saves it, as leaving the cell does
  const next = event.relatedTarget as Element | null
  if (!editor.cell.value || !document.hasFocus()) return
  if (next?.closest('.dou-sheet__input, .dou-sheet__assist')) return
  editor.commit()
}

let detach: (() => void) | undefined
onMounted(() => {
  const textarea = root.value?.querySelector('textarea')
  const anchor = root.value?.querySelector<HTMLElement>('.dou-code-editor') ?? undefined
  if (textarea) detach = editor.attach(textarea, { managed: true, anchor })
})
// the function list under the cell belongs to the box while it edits
watchEffect(() => {
  const textarea = root.value?.querySelector('textarea')
  if (!textarea) return
  if (editingHere.value) {
    textarea.setAttribute('aria-autocomplete', 'list')
    textarea.setAttribute('aria-controls', editor.helpId)
  } else {
    textarea.removeAttribute('aria-autocomplete')
    textarea.removeAttribute('aria-controls')
  }
})
onBeforeUnmount(() => detach?.())
</script>

<template>
  <div ref="root" class="dou-sheet-formula-bar dou-sheet-code-bar">
    <SheetNameBox />
    <span class="dou-sheet-formula-bar__mark" aria-hidden="true"><FunctionIcon /></span>
    <div class="dou-sheet-code-bar__box" @keydown.capture="onKey">
      <DouCodeInput
        ref="input"
        :model-value="text"
        class="dou-sheet-code-bar__input"
        multiline
        :autosize="{ minRows: 1, maxRows: 5 }"
        :language="isFormula ? sheetFormula : null"
        :extensions="extensions"
        :readonly="sheet.readonly.value"
        :aria-label="m.formulaBox"
        @transaction="onTransaction"
        @blur="onBlur"
      />
    </div>
  </div>
</template>
