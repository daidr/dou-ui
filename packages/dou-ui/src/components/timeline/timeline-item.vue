<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { TimelineItemProps, TimelineItemSlots } from './timeline'

defineOptions({ name: 'DouTimelineItem' })

const props = withDefaults(defineProps<TimelineItemProps>(), {
  tone: 'neutral',
  pending: false,
})
const slots = defineSlots<TimelineItemSlots>()

const ns = useNamespace('timeline')
const hasTime = computed(() => !!props.time || !!slots.time)
const hasTitle = computed(() => !!props.title || !!slots.title)
</script>

<template>
  <li
    :class="[ns.e('item'), ns.m(tone), ns.is('pending', pending), ns.is('custom-dot', !!slots.dot)]"
  >
    <span :class="ns.e('rail')" aria-hidden="true">
      <span :class="ns.e('dot')"><slot name="dot" /></span>
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
