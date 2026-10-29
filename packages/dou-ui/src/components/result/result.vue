<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { toneIcon } from '../../utils/tone-icons'
import type { Tone } from '../../utils/types'
import type { ResultProps, ResultSlots } from './result'

defineOptions({ name: 'DouResult' })

const props = withDefaults(defineProps<ResultProps>(), { status: 'info' })
const slots = defineSlots<ResultSlots>()

const ns = useNamespace('result')

const tone = computed<Tone>(() => (props.status === 'info' ? 'neutral' : props.status))
const Icon = () => toneIcon(tone.value)
// Success and info are news; warning and danger need attention now.
const role = computed(() =>
  props.status === 'warning' || props.status === 'danger' ? 'alert' : 'status',
)
</script>

<template>
  <div :class="[ns.b(), ns.m(status)]" :role="role">
    <div :class="ns.e('icon')" aria-hidden="true">
      <slot name="icon"><Icon /></slot>
    </div>
    <div v-if="slots.title || title" :class="ns.e('title')">
      <slot name="title">{{ title }}</slot>
    </div>
    <div v-if="slots.description || description" :class="ns.e('description')">
      <slot name="description">{{ description }}</slot>
    </div>
    <div v-if="slots.default" :class="ns.e('actions')">
      <slot />
    </div>
    <div v-if="slots.extra" :class="ns.e('extra')">
      <slot name="extra" />
    </div>
  </div>
</template>
