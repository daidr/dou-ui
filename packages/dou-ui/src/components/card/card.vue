<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { CardProps, CardSlots } from './card'

defineOptions({ name: 'DouCard' })

const props = withDefaults(defineProps<CardProps>(), {
  padding: 'md',
  raised: false,
  interactive: false,
  as: 'div',
})
const slots = defineSlots<CardSlots>()

const ns = useNamespace('card')

const hasHeader = computed(
  () => !!(slots.header || slots.extra || props.title || props.description),
)

const classes = computed(() => [
  ns.b(),
  ns.m(`padding-${props.padding}`),
  ns.is('raised', props.raised),
  ns.is('interactive', props.interactive),
])
</script>

<template>
  <component :is="as" :class="classes">
    <header v-if="hasHeader" :class="ns.e('header')">
      <div :class="ns.e('heading')">
        <slot name="header">
          <div v-if="title" :class="ns.e('title')">{{ title }}</div>
          <div v-if="description" :class="ns.e('description')">{{ description }}</div>
        </slot>
      </div>
      <div v-if="slots.extra" :class="ns.e('extra')">
        <slot name="extra" />
      </div>
    </header>
    <div v-if="slots.default" :class="ns.e('body')">
      <slot />
    </div>
    <footer v-if="slots.footer" :class="ns.e('footer')">
      <slot name="footer" />
    </footer>
  </component>
</template>
