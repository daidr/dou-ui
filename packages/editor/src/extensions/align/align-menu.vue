<script setup lang="ts">
import { TextAlignCenterIcon, TextAlignLeftIcon, TextAlignRightIcon } from '@dou-ui/icons'
import { DouButton, DouDropdown, DouDropdownItem, DouDropdownRadioGroup, DouTooltip } from 'dou-ui'
import { computed } from 'vue'
import type { BlockAlign } from '../../core/align'
import { useEditor, useToolbarMenu } from '../../editor'
import { currentAlign, setAlign } from './commands'

const { view, state, messages } = useEditor()

const icons = { left: TextAlignLeftIcon, center: TextAlignCenterIcon, right: TextAlignRightIcon }
const shortcuts = { left: 'mod+shift+l', center: 'mod+shift+e', right: 'mod+shift+r' }
const aligns = ['left', 'center', 'right'] as const

const align = computed(() => (state.value ? currentAlign(state.value) : undefined))

function choose(value: unknown) {
  const current = view.value
  if (!current) return
  // left is the reading direction: store nothing
  const next = value === 'left' ? null : (value as BlockAlign)
  setAlign(next)(current.state, current.dispatch)
  current.focus()
}

const open = useToolbarMenu()
</script>

<template>
  <DouTooltip
    v-if="align !== undefined"
    :content="messages.align.label"
    :disabled="open"
    placement="bottom"
  >
    <span class="dou-editor-bubble__trigger">
      <DouDropdown v-model:open="open" placement="bottom-start" class="dou-editor-menu">
        <DouButton size="sm" variant="ghost" :aria-label="messages.align.label">
          <component :is="icons[align ?? 'left']" />
        </DouButton>
        <template #menu>
          <DouDropdownRadioGroup :model-value="align ?? 'left'" @update:model-value="choose">
            <DouDropdownItem
              v-for="name in aligns"
              :key="name"
              :value="name"
              :shortcut="shortcuts[name]"
            >
              <template #prefix><component :is="icons[name]" /></template>
              {{ messages.align[name] }}
            </DouDropdownItem>
          </DouDropdownRadioGroup>
        </template>
      </DouDropdown>
    </span>
  </DouTooltip>
</template>
