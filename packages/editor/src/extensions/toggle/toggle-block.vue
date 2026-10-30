<script setup lang="ts">
import { ChevronRightIcon } from '@dou-ui/icons'
import { computed } from 'vue'
import type { BlockProps } from '../../core/model'
import { EditorContent } from '../../define-block'
import { useEditorContext } from '../../editor'
import { flipToggle, isToggleOpen } from './state'

const props = defineProps<{
  block: { id: string; type: string; props: BlockProps }
  updateProps: (props: BlockProps) => void
  selected: boolean
  editable: boolean
}>()

const { messages, state, view } = useEditorContext()
const open = computed(() => isToggleOpen(state.value, props.block.id))

function flip() {
  if (view.value) flipToggle(view.value, props.block.id)
}
</script>

<template>
  <div class="dou-editor-toggle">
    <span class="dou-editor-toggle__control" contenteditable="false">
      <button
        type="button"
        class="dou-editor-toggle__button"
        :class="{ 'is-open': open }"
        :aria-expanded="open"
        :aria-label="open ? messages.toggle.collapse : messages.toggle.expand"
        @mousedown.prevent
        @click="flip"
      >
        <ChevronRightIcon />
      </button>
    </span>
    <EditorContent />
  </div>
</template>
