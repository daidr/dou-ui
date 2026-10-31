<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import { DouButton, DouDialog, DouTextarea } from 'dou-ui'
import { CopyCheckIcon, CopyIcon, DownloadIcon, FileUpIcon } from '@dou-ui/icons'
import { checkDocument, checkDocumentShape, documentPaths, migrateDocument } from '../core/check'
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
  const shape = checkDocumentShape(data)
  if (shape.length)
    return {
      findings: shape.map((problem) => ({
        path: problem.path,
        text:
          (problem.code === 'required' ? words.shape.required : words.shape[problem.expected]) ??
          problem.message,
        blocking: true,
      })),
    }
  let document: FormDocument
  try {
    document = migrateDocument(data)
  } catch {
    const version = String((data as { version?: unknown }).version)
    return {
      findings: [
        {
          path: 'version',
          text: formatMessage(words.problems.version!, { text: version }),
          blocking: true,
        },
      ],
    }
  }
  const paths = documentPaths(document)
  const problems = checkDocument(document, {
    fields: [...state.fields.values()],
    functions: state.functionNames.value,
  })
  const expressionWords = state.messages.expression.problems
  const findings = problems.map((problem) => {
    const at = problem.nodeId ? (paths.get(problem.nodeId) ?? '') : ''
    const path = problem.property ? `${at}.${problem.property}` : at
    const own = problem.expression
    const said = own
      ? formatMessage(expressionWords[own.code] ?? own.message, { text: own.text })
      : formatMessage(words.problems[problem.code] ?? problem.message, { text: problem.text })
    return { path, text: said, blocking: BLOCKING.has(problem.code) }
  })
  return { document, findings }
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
  const blob = new Blob([draft.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'form.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
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
