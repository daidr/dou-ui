<script setup lang="ts">
import { ChevronDownIcon } from '@dou-ui/icons'
import { DouCopyButton, DouDropdown, DouDropdownItem, DouDropdownRadioGroup } from 'dou-ui'
import { computed } from 'vue'
import { findBlockById } from '../../core/blocks'
import type { BlockProps } from '../../core/model'
import { EditorContent } from '../../define-block'
import { useEditor } from '../../editor'
import type { CodeLanguage } from './languages'

const props = defineProps<{
  block: { id: string; type: string; props: BlockProps }
  updateProps: (props: BlockProps) => void
  selected: boolean
  editable: boolean
  languages: CodeLanguage[]
}>()

const { messages, view } = useEditor()

const language = computed(() => String(props.block.props.language ?? ''))
// a language from elsewhere (pasted, or set in code) still shows by its name
const choices = computed(() => {
  const list = [{ value: '', label: messages.value.codeBlock.plainText }, ...props.languages]
  if (language.value && !list.some((item) => item.value === language.value))
    list.push({ value: language.value, label: language.value })
  return list
})
const label = computed(
  () => choices.value.find((item) => item.value === language.value)?.label ?? language.value,
)

function choose(value: unknown) {
  props.updateProps({ language: String(value ?? '') })
  view.value?.focus()
}

// read when the button is pressed: the text changes while the block is edited
function code() {
  const current = view.value
  if (!current) return ''
  return findBlockById(current.state.doc, props.block.id)?.content.textContent ?? ''
}
</script>

<template>
  <div class="dou-editor-code__bar" contenteditable="false">
    <DouDropdown v-if="editable" placement="bottom-end">
      <button type="button" class="dou-editor-code__language" :title="messages.codeBlock.language">
        {{ label }}
        <ChevronDownIcon />
      </button>
      <template #menu>
        <DouDropdownRadioGroup :model-value="language" @update:model-value="choose">
          <DouDropdownItem v-for="item in choices" :key="item.value" :value="item.value">
            {{ item.label }}
          </DouDropdownItem>
        </DouDropdownRadioGroup>
      </template>
    </DouDropdown>
    <span v-else-if="language" class="dou-editor-code__language is-static">{{ label }}</span>
    <DouCopyButton :text="code" size="sm" />
  </div>
  <pre class="dou-editor-code__pre"><EditorContent as="code" /></pre>
</template>
