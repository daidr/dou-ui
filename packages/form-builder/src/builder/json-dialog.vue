<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import { DouButton, DouDialog, DouTextarea, downloadBlob } from 'dou-ui'
import { CopyCheckIcon, CopyIcon, DownloadIcon, FileUpIcon, IndentIcon } from '@dou-ui/icons'
import { checkDocument, checkDocumentShape, migrateDocument } from '../core/check'
import type { DocumentProblem } from '../core/check'
import type { FormDocument } from '../core/types'
import { formatMessage } from '../locale'
import { useBuilderState } from './context'

/**
 * The form as JSON: to read, copy, download, or replace by pasting or
 * opening a file. What is wrong with new text is listed by its path as it
 * is typed; problems that would break the builder keep it from applying.
 */
defineOptions({ name: 'DouFormBuilderJson' })

const open = defineModel<boolean>('open', { default: false })

const state = useBuilderState()
const messages = computed(() => state.messages.json)

const draft = shallowRef('')
const original = shallowRef('')
watch(
  open,
  (now) => {
    if (!now) return
    original.value = JSON.stringify(state.document, null, 2)
    draft.value = original.value
  },
  { immediate: true },
)

interface Finding {
  path: string
  text: string
  /** Applying it would break the builder. */
  blocking: boolean
}

/** Problems that leave the builder unable to place nodes; the rest only warn. */
const BLOCKING = new Set<DocumentProblem['code']>([
  'version',
  'duplicate-id',
  'misplaced-page',
  'not-a-page',
])

/** Where `JSON.parse` stopped, as a line and column, when its message gives the position. */
function syntaxPlace(text: string, error: unknown) {
  const match = /position (\d+)/.exec(String((error as Error)?.message))
  if (!match) return undefined
  const before = text.slice(0, Number(match[1]))
  const lines = before.split('\n')
  return { line: lines.length, column: lines[lines.length - 1]!.length + 1 }
}

const analysis = computed<{ document?: FormDocument; findings: Finding[] }>(() => {
  const text = draft.value
  const words = messages.value
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (error) {
    const place = syntaxPlace(text, error)
    return {
      findings: [
        {
          path: '',
          text: place ? formatMessage(words.syntaxAt, place) : words.syntax,
          blocking: true,
        },
      ],
    }
  }
  // Problems of shape block applying, and are listed together with those of content.
  const findings: Finding[] = checkDocumentShape(data).map((problem) => ({
    path: problem.path,
    text:
      (problem.code === 'required' ? words.shape.required : words.shape[problem.expected]) ??
      problem.message,
    blocking: true,
  }))
  let document: FormDocument
  try {
    document = migrateDocument(data)
  } catch {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) return { findings }
    const version = String((data as { version?: unknown }).version)
    findings.push({
      path: 'version',
      text: formatMessage(words.problems.version!, { text: version }),
      blocking: true,
    })
    return { findings }
  }
  let problems: DocumentProblem[] = []
  try {
    problems = checkDocument(document, {
      fields: [...state.fields.values()],
      functions: state.functionNames.value,
    })
  } catch {
    // Content too far off its shape to read; the shape problems say why.
  }
  const expressionWords = state.messages.expression.problems
  for (const problem of problems) {
    const own = problem.expression
    const said = own
      ? formatMessage(expressionWords[own.code] ?? own.message, { text: own.text })
      : formatMessage(words.problems[problem.code] ?? problem.message, { text: problem.text })
    findings.push({ path: problem.path, text: said, blocking: BLOCKING.has(problem.code) })
  }
  return { document: findings.some((f) => f.blocking) ? undefined : document, findings }
})

const blocked = computed(() => analysis.value.findings.some((finding) => finding.blocking))
const changed = computed(() => draft.value !== original.value)
const SHOWN = 8
const shownFindings = computed(() => analysis.value.findings.slice(0, SHOWN))
const more = computed(() => analysis.value.findings.length - shownFindings.value.length)

function apply() {
  const document = analysis.value.document
  if (!document || blocked.value) return
  state.replace(document)
  open.value = false
}

/** The text parsed, or `undefined` while it is not JSON. */
const parsed = computed(() => {
  try {
    return { data: JSON.parse(draft.value) as unknown }
  } catch {
    return undefined
  }
})
const formatted = computed(() =>
  parsed.value ? JSON.stringify(parsed.value.data, null, 2) : undefined,
)
function format() {
  if (formatted.value !== undefined) draft.value = formatted.value
}

const file = useTemplateRef<HTMLInputElement>('file')
async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const chosen = input.files?.[0]
  input.value = ''
  if (chosen) draft.value = await chosen.text()
}

const copied = shallowRef(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(copiedTimer))
async function copy() {
  try {
    await navigator.clipboard.writeText(draft.value)
  } catch {
    return
  }
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = false), 1500)
}

function download() {
  downloadBlob(new Blob([draft.value], { type: 'application/json' }), 'form.json')
}
</script>

<template>
  <DouDialog
    v-model:open="open"
    :title="messages.title"
    width="640px"
    class="dou-form-builder__json"
    destroy-on-close
  >
    <DouTextarea
      v-model="draft"
      :rows="16"
      :invalid="blocked"
      :aria-label="messages.title"
      spellcheck="false"
      class="dou-form-builder__json-text"
    />
    <div class="dou-form-builder__json-status" aria-live="polite">
      <ul v-if="analysis.findings.length" class="dou-form-builder__json-problems">
        <li
          v-for="(finding, index) in shownFindings"
          :key="index"
          :class="['dou-form-builder__json-problem', finding.blocking && 'is-blocking']"
        >
          <code v-if="finding.path" class="dou-form-builder__json-path">{{ finding.path }}</code>
          <span>{{ finding.text }}</span>
        </li>
        <li v-if="more > 0" class="dou-form-builder__json-problem">
          {{ formatMessage(messages.more, { count: more }) }}
        </li>
      </ul>
      <div v-else class="dou-form-builder__json-fine">{{ messages.fine }}</div>
    </div>
    <template #footer>
      <div class="dou-form-builder__json-footer">
        <input
          ref="file"
          type="file"
          accept=".json,application/json"
          class="dou-form-builder__json-file"
          tabindex="-1"
          aria-hidden="true"
          @change="onFile"
        />
        <DouButton
          size="sm"
          variant="ghost"
          :disabled="formatted === undefined || formatted === draft"
          @click="format"
        >
          <template #leading><IndentIcon /></template>
          {{ messages.format }}
        </DouButton>
        <DouButton size="sm" variant="ghost" @click="file?.click()">
          <template #leading><FileUpIcon /></template>
          {{ messages.file }}
        </DouButton>
        <DouButton size="sm" variant="ghost" @click="download">
          <template #leading><DownloadIcon /></template>
          {{ messages.download }}
        </DouButton>
        <DouButton size="sm" variant="ghost" @click="copy">
          <template #leading>
            <CopyCheckIcon v-if="copied" />
            <CopyIcon v-else />
          </template>
          {{ copied ? messages.copied : messages.copy }}
        </DouButton>
        <span class="dou-form-builder__json-spacer" />
        <DouButton size="sm" variant="outline" @click="open = false">
          {{ messages.cancel }}
        </DouButton>
        <DouButton size="sm" tone="primary" :disabled="!changed || blocked" @click="apply">
          {{ messages.apply }}
        </DouButton>
      </div>
    </template>
  </DouDialog>
</template>
