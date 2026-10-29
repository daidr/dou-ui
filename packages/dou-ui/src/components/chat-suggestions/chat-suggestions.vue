<script setup lang="ts">
import { computed, useId } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type {
  ChatSuggestion,
  ChatSuggestionsEmits,
  ChatSuggestionsProps,
  ChatSuggestionsSlots,
} from './chat-suggestions'

defineOptions({ name: 'DouChatSuggestions' })

const props = withDefaults(defineProps<ChatSuggestionsProps>(), {
  items: () => [],
  variant: 'chip',
})
const emit = defineEmits<ChatSuggestionsEmits>()
const slots = defineSlots<ChatSuggestionsSlots>()

const ns = useNamespace('chat-suggestions')
const id = useId()

const list = computed<ChatSuggestion[]>(() =>
  props.items.map((item) => (typeof item === 'string' ? { label: item } : item)),
)
const style = computed(() =>
  props.variant === 'card' && props.columns
    ? { '--dou-chat-suggestions-columns': props.columns }
    : undefined,
)
const hasTitle = computed(() => !!props.title || !!slots.title)

function pick(item: ChatSuggestion) {
  if (!item.disabled) emit('select', item.value ?? item.label, item)
}
</script>

<template>
  <div :class="[ns.b(), ns.m(variant), ns.is('columns', !!style)]" :style="style">
    <div v-if="hasTitle" :id="`${id}-title`" :class="ns.e('title')">
      <slot name="title">{{ title }}</slot>
    </div>
    <ul :class="ns.e('list')" :aria-labelledby="hasTitle ? `${id}-title` : undefined">
      <li v-for="(item, index) in list" :key="item.value ?? `${index}-${item.label}`">
        <button type="button" :class="ns.e('item')" :disabled="item.disabled" @click="pick(item)">
          <slot name="item" :item="item">
            <component :is="item.icon" v-if="item.icon" :class="ns.e('icon')" />
            <span :class="ns.e('text')">
              <span :class="ns.e('label')">{{ item.label }}</span>
              <span v-if="variant === 'card' && item.description" :class="ns.e('description')">
                {{ item.description }}
              </span>
            </span>
          </slot>
        </button>
      </li>
    </ul>
  </div>
</template>
