<script setup lang="ts">
import { DouDropdown, DouDropdownItem, DouDropdownRadioGroup } from 'dou-ui'
import { computed } from 'vue'
import type { BlockProps } from '../../core/model'
import { EditorContent } from '../../define-block'
import { useEditorContext } from '../../editor'
import { calloutTones, type CalloutTone } from './tones'

const props = defineProps<{
  block: { id: string; type: string; props: BlockProps }
  updateProps: (props: BlockProps) => void
  selected: boolean
  editable: boolean
}>()

const { messages, view } = useEditorContext()

const tone = computed<CalloutTone>(() => {
  const value = props.block.props.tone as CalloutTone
  return value in calloutTones ? value : 'info'
})
const icon = computed(() => calloutTones[tone.value])

function choose(value: unknown) {
  props.updateProps({ tone: String(value) })
  view.value?.focus()
}
</script>

<template>
  <div class="dou-editor-callout" :class="`is-${tone}`">
    <span class="dou-editor-callout__control" contenteditable="false">
      <DouDropdown v-if="editable" placement="bottom-start">
        <button
          type="button"
          class="dou-editor-callout__icon"
          :aria-label="`${messages.callout.tones[tone]}，${messages.callout.change}`"
        >
          <component :is="icon" />
        </button>
        <template #menu>
          <DouDropdownRadioGroup :model-value="tone" @update:model-value="choose">
            <DouDropdownItem v-for="(item, name) in calloutTones" :key="name" :value="name">
              <template #prefix><component :is="item" /></template>
              {{ messages.callout.tones[name] }}
            </DouDropdownItem>
          </DouDropdownRadioGroup>
        </template>
      </DouDropdown>
      <span
        v-else
        class="dou-editor-callout__icon"
        role="img"
        :aria-label="messages.callout.tones[tone]"
      >
        <component :is="icon" />
      </span>
    </span>
    <EditorContent />
  </div>
</template>
