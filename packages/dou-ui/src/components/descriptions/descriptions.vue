<script setup lang="ts">
import { computed, provide, toRef } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { descriptionsKey } from './descriptions'
import type { DescriptionsProps, DescriptionsSlots } from './descriptions'

defineOptions({ name: 'DouDescriptions' })

const props = withDefaults(defineProps<DescriptionsProps>(), {
  columns: 3,
  layout: 'vertical',
  variant: 'plain',
  bordered: true,
})
const slots = defineSlots<DescriptionsSlots>()

const ns = useNamespace('descriptions')

const columns = computed(() => Math.max(1, Math.floor(props.columns)))
provide(descriptionsKey, { columns: toRef(() => columns.value) })

const style = computed(() => {
  const vars: Record<string, string> = { '--dou-descriptions-columns': String(columns.value) }
  if (props.labelWidth !== undefined) {
    vars['--dou-descriptions-label-width'] =
      typeof props.labelWidth === 'number' ? `${props.labelWidth}px` : props.labelWidth
  }
  return vars
})

const classes = computed(() => [
  ns.b(),
  ns.m(props.layout),
  ns.m(props.variant),
  ns.is('bordered', props.bordered),
])
</script>

<template>
  <div :class="classes" :style="style">
    <div v-if="slots.title || slots.extra || title" :class="ns.e('header')">
      <div :class="ns.e('title')">
        <slot name="title">{{ title }}</slot>
      </div>
      <div v-if="slots.extra" :class="ns.e('extra')">
        <slot name="extra" />
      </div>
    </div>
    <div :class="ns.e('body')">
      <dl :class="ns.e('list')">
        <slot />
      </dl>
    </div>
  </div>
</template>
