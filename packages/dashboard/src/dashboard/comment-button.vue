<script setup lang="ts">
import { MessageCircleIcon } from '@dou-ui/icons'
import { DouButton, DouTooltip, type Placement } from 'dou-ui'
import { computed } from 'vue'
import { format, type DashboardMessages } from '../locale'
import type { DashboardComments } from './comments'

/*
 * A widget's comment button, in its title bar and its full screen view:
 * with how many open threads there are, opening them or the box to start one.
 */

const props = withDefaults(
  defineProps<{
    id: string
    comments: DashboardComments
    messages: DashboardMessages
    /** Where the tooltip goes: in the full screen view, clear of the dialog's close button above. */
    tooltipPlacement?: Placement
  }>(),
  { tooltipPlacement: 'top' },
)

const count = computed(() => props.comments.openOn.value.get(props.id)?.length ?? 0)
/** Shown with something to open, or a thread to start. */
const shown = computed(
  () => props.comments.enabled.value && (props.comments.writable.value || count.value > 0),
)
const expanded = computed(() => props.comments.current.value === props.id)
const label = computed(() =>
  count.value ? format(props.messages.comments, { count: count.value }) : props.messages.comment,
)

function toggle(event: MouseEvent) {
  if (expanded.value) return props.comments.close()
  // pressed from the keyboard (no clicks counted): straight into the reply box;
  // a click or tap only shows the threads, without bringing up a phone's keyboard
  props.comments.start(props.id, event.detail === 0)
}
</script>

<template>
  <DouTooltip v-if="shown" :content="label" :placement="tooltipPlacement">
    <DouButton
      size="sm"
      variant="ghost"
      :class="['dou-dashboard__comment', count && 'has-threads']"
      :aria-label="label"
      :aria-expanded="expanded"
      :data-dou-comment="id"
      @click="toggle"
    >
      <template v-if="count" #leading><MessageCircleIcon /></template>
      <template v-if="count">{{ count }}</template>
      <MessageCircleIcon v-else />
    </DouButton>
  </DouTooltip>
</template>
