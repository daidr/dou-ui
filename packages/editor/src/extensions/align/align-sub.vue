<script setup lang="ts">
import { TextAlignCenterIcon, TextAlignLeftIcon, TextAlignRightIcon } from '@dou-ui/icons'
import { DouDropdownItem, DouDropdownRadioGroup, DouDropdownSub } from 'dou-ui'
import { computed } from 'vue'
import type { BlockAlign } from '../../core/align'
import type { Block } from '../../core/model'
import { useEditor } from '../../editor'
import { setAlign } from './commands'

const props = defineProps<{ block: Block }>()
const { view, kit, messages } = useEditor()

const icons = { left: TextAlignLeftIcon, center: TextAlignCenterIcon, right: TextAlignRightIcon }
const aligns = ['left', 'center', 'right'] as const

const alignable = computed(() => !!kit.schema.nodes[props.block.type]?.spec.attrs?.align)

function choose(value: unknown) {
  const current = view.value
  if (!current) return
  setAlign(value === 'left' ? null : (value as BlockAlign), props.block.id)(
    current.state,
    current.dispatch,
  )
}
</script>

<template>
  <DouDropdownSub v-if="alignable" :title="messages.align.label">
    <DouDropdownRadioGroup :model-value="block.props.align ?? 'left'" @update:model-value="choose">
      <DouDropdownItem v-for="name in aligns" :key="name" :value="name">
        <template #prefix><component :is="icons[name]" /></template>
        {{ messages.align[name] }}
      </DouDropdownItem>
    </DouDropdownRadioGroup>
  </DouDropdownSub>
</template>
