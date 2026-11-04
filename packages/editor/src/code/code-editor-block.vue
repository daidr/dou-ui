<script setup lang="ts">
import { DouCodeEditor, type CodeExtension } from '@dou-ui/code'
import { ChevronDownIcon } from '@dou-ui/icons'
import {
  DouCopyButton,
  DouDropdown,
  DouDropdownItem,
  DouDropdownRadioGroup,
  useGlobalConfig,
} from 'dou-ui'
import type { EditorView } from 'prosemirror-view'
import { computed, shallowRef } from 'vue'
import { useEditor } from '../editor'
import { findCodeLanguage } from './languages'
import type { CodeEditorViewOptions, CodeEditorViewState } from './types'

const props = defineProps<{
  state: CodeEditorViewState
  options: CodeEditorViewOptions
  extensions: CodeExtension[]
  view: EditorView
  updateProps: (props: Record<string, unknown>) => void
}>()
const emit = defineEmits<{ focus: [] }>()

const { messages } = useEditor()
const config = useGlobalConfig()
const editor = shallowRef<InstanceType<typeof DouCodeEditor>>()

const value = computed(() => String(props.state.block.props.language ?? ''))
const entry = computed(() => findCodeLanguage(props.options.languages, value.value))
// a language the picker doesn't have (pasted, or set in code) still shows by its name
const choices = computed(() => {
  const list = [
    { value: '', label: messages.value.codeBlock.plainText },
    ...props.options.languages.map((item) => ({
      value: item.language.name,
      label: item.label,
    })),
  ]
  if (value.value && !entry.value) list.push({ value: value.value, label: value.value })
  return list
})
const picked = computed(() => entry.value?.language.name ?? value.value)
const label = computed(() => entry.value?.label ?? value.value)
const ariaLabel = computed(() =>
  label.value ? `${messages.value.types.codeBlock} ${label.value}` : messages.value.types.codeBlock,
)

function choose(next: unknown) {
  props.updateProps({ language: String(next ?? '') })
  editor.value?.focus()
}

// read when the button is pressed: the code changes as it is edited
const code = () => editor.value?.doc.toString() ?? props.state.text
</script>

<template>
  <div class="dou-editor-code__bar">
    <DouDropdown v-if="state.editable" placement="bottom-end">
      <button type="button" class="dou-editor-code__language" :title="messages.codeBlock.language">
        {{ label || messages.codeBlock.plainText }}
        <ChevronDownIcon />
      </button>
      <template #menu>
        <DouDropdownRadioGroup :model-value="picked" @update:model-value="choose">
          <DouDropdownItem v-for="item in choices" :key="item.value" :value="item.value">
            {{ item.label }}
          </DouDropdownItem>
        </DouDropdownRadioGroup>
      </template>
    </DouDropdown>
    <span v-else-if="label" class="dou-editor-code__language is-static">{{ label }}</span>
    <DouCopyButton :text="code" size="sm" />
  </div>
  <DouCodeEditor
    ref="editor"
    class="dou-editor-code__editor"
    :model-value="state.text"
    :language="entry?.language ?? null"
    :readonly="!state.editable"
    :line-numbers="options.lineNumbers ?? false"
    :gutter="options.lineNumbers ?? false"
    :bordered="false"
    :wrap="options.wrap ?? false"
    :tab-size="options.tabSize ?? 2"
    :tab-indents="true"
    :extensions="extensions"
    :teleport="config.teleport || 'body'"
    :aria-label="ariaLabel"
    @focus="emit('focus')"
  />
</template>
