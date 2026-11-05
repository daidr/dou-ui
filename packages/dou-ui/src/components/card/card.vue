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

// A button may only hold phrasing content: inside one the parts are spans.
const inButton = computed(() => props.as === 'button')
const part = (tag: string) => (inButton.value ? 'span' : tag)

const classes = computed(() => [
  ns.b(),
  ns.m(`padding-${props.padding}`),
  ns.is('raised', props.raised),
  ns.is('interactive', props.interactive || inButton.value),
])
</script>

<template>
  <component :is="as" :class="classes" :type="inButton ? 'button' : undefined">
    <component :is="part('header')" v-if="hasHeader" :class="ns.e('header')">
      <component :is="part('div')" :class="ns.e('heading')">
        <slot name="header">
          <component :is="part('div')" v-if="title" :class="ns.e('title')">{{ title }}</component>
          <component :is="part('div')" v-if="description" :class="ns.e('description')">
            {{ description }}
          </component>
        </slot>
      </component>
      <component :is="part('div')" v-if="slots.extra" :class="ns.e('extra')">
        <slot name="extra" />
      </component>
    </component>
    <component :is="part('div')" v-if="slots.default" :class="ns.e('body')">
      <slot />
    </component>
    <component :is="part('footer')" v-if="slots.footer" :class="ns.e('footer')">
      <slot name="footer" />
    </component>
  </component>
</template>
