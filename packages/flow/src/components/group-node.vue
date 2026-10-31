<script setup lang="ts">
import { ChevronDownIcon } from '@dou-ui/icons'
import { nextTick, ref, useTemplateRef } from 'vue'
import { useFlowEditor } from '../context'
import type { NodeViewProps } from '../core/node-types'
import type { GroupNodeData } from './group-node'

const props = defineProps<NodeViewProps<GroupNodeData>>()
const { messages } = useFlowEditor()

const editing = ref(false)
const draft = ref('')
const input = useTemplateRef<HTMLInputElement>('input')

function edit() {
  if (props.readonly) return
  draft.value = props.data.label ?? ''
  editing.value = true
  void nextTick(() => {
    input.value?.focus()
    input.value?.select()
  })
}

function finish(save: boolean) {
  if (!editing.value) return
  editing.value = false
  if (save && draft.value.trim() !== (props.data.label ?? ''))
    props.updateData({ label: draft.value.trim() })
}

function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Enter') finish(true)
  else if (event.key === 'Escape') finish(false)
  else return
  event.preventDefault()
  event.stopPropagation()
}
</script>

<template>
  <div class="dou-flow-group-node" :class="{ 'is-collapsed': data.collapsed }">
    <div class="dou-flow-group-node__head">
      <button
        type="button"
        class="dou-flow-group-node__toggle"
        :aria-label="data.collapsed ? messages.expand : messages.collapse"
        :aria-expanded="!data.collapsed"
        :disabled="readonly"
        @click="updateData({ collapsed: !data.collapsed || undefined })"
      >
        <ChevronDownIcon />
      </button>
      <input
        v-if="editing"
        ref="input"
        v-model="draft"
        class="dou-flow-group-node__input"
        :aria-label="messages.groupName"
        @keydown="onKeydown"
        @blur="finish(true)"
      />
      <span v-else class="dou-flow-group-node__title" @dblclick.stop="edit">
        {{ data.label || messages.group }}
      </span>
    </div>
  </div>
</template>
