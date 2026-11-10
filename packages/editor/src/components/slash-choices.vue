<script setup lang="ts">
import { labelOf, type BlockOptionChoices } from '../core/extension'
import type { EditorMessages } from '../locale'

/** The variants of a slash menu option: its title, then the option's own panel or a list. */
defineProps<{
  choices: BlockOptionChoices
  active: number
  messages: EditorMessages
  idPrefix: string
}>()
const emit = defineEmits<{ hover: [index: number]; choose: [index: number] }>()
</script>

<template>
  <div class="dou-editor-slash__choices-title" aria-hidden="true">
    {{ labelOf(choices.title, messages) }}
  </div>
  <component
    :is="choices.component"
    v-if="choices.component"
    :id-prefix="idPrefix"
    :items="choices.items"
    :active="active"
    :messages="messages"
    @hover="emit('hover', $event)"
    @choose="emit('choose', $event)"
  />
  <template v-else>
    <div
      v-for="(item, index) in choices.items"
      :id="`${idPrefix}-${index}`"
      :key="index"
      role="option"
      :aria-selected="index === active"
      :class="['dou-dropdown__item', { 'is-active': index === active }]"
      @pointermove="emit('hover', index)"
      @click="emit('choose', index)"
    >
      {{ labelOf(item.label, messages) }}
    </div>
  </template>
</template>
