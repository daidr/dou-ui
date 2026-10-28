<script setup lang="ts">
import { LoaderIcon } from '@dou-ui/icons'
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { TimelineItemProps, TimelineItemSlots } from './timeline'

defineOptions({ name: 'DouTimelineItem' })

const props = withDefaults(defineProps<TimelineItemProps>(), {
  tone: 'neutral',
  pending: false,
  loading: false,
})
const slots = defineSlots<TimelineItemSlots>()

const ns = useNamespace('timeline')
const hasTime = computed(() => !!props.time || !!slots.time)
const hasTitle = computed(() => !!props.title || !!slots.title)
// A spinner outranks a custom dot: the item is busy, whatever it usually shows.
const customDot = computed(() => !props.loading && !!slots.dot)
</script>

<template>
  <li
    :class="[
      ns.e('item'),
      ns.m(tone),
      ns.is('pending', pending),
      ns.is('loading', loading),
      ns.is('custom-dot', customDot),
    ]"
    :aria-busy="loading || undefined"
  >
    <span :class="ns.e('rail')" aria-hidden="true">
      <span :class="ns.e('dot')">
        <LoaderIcon v-if="loading" />
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
