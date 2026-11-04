<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import DouStatusDot from '../status-dot/status-dot.vue'
import type { TimelineItemProps, TimelineItemSlots } from './timeline'

defineOptions({ name: 'DouTimelineItem' })

const props = withDefaults(defineProps<TimelineItemProps>(), {
  tone: 'neutral',
  pending: false,
  active: false,
})
const slots = defineSlots<TimelineItemSlots>()

const ns = useNamespace('timeline')
const hasTime = computed(() => !!props.time || !!slots.time)
const hasTitle = computed(() => !!props.title || !!slots.title)
// The current step always shows the plain dot, so its ripple has a round edge to grow from.
const customDot = computed(() => !props.active && !!slots.dot)
</script>

<template>
  <li
    :class="[
      ns.e('item'),
      ns.m(tone),
      ns.is('pending', pending),
      ns.is('active', active),
      ns.is('custom-dot', customDot),
    ]"
    :aria-current="active ? 'step' : undefined"
  >
    <span :class="ns.e('rail')" aria-hidden="true">
      <span :class="ns.e('dot')">
        <DouStatusDot v-if="active" ripple />
        <slot v-else name="dot" />
      </span>
      <span :class="ns.e('line')" />
    </span>
    <div :class="ns.e('body')">
      <div v-if="hasTime" :class="ns.e('time')">
        <slot name="time">{{ time }}</slot>
      </div>
      <div v-if="hasTitle" :class="ns.e('title')">
        <slot name="title">{{ title }}</slot>
      </div>
      <div v-if="slots.default" :class="ns.e('content')"><slot /></div>
    </div>
  </li>
</template>
