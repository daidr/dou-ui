<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type { EmptyProps, EmptySlots } from './empty'

defineOptions({ name: 'DouEmpty' })

const props = withDefaults(defineProps<EmptyProps>(), { size: 'md' })
const slots = defineSlots<EmptySlots>()

const ns = useNamespace('empty')
const { t } = useLocale()

const title = computed(() => {
  if (props.title) return props.title
  return props.description || slots.description ? '' : t('empty.title')
})
</script>

<template>
  <div :class="[ns.b(), ns.m(size)]">
    <div :class="ns.e('icon')" aria-hidden="true">
      <slot name="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path
            d="M3.75 13.5l2.6-6.9A1.75 1.75 0 0 1 8 5.5h8a1.75 1.75 0 0 1 1.65 1.1l2.6 6.9"
            stroke-linejoin="round"
          />
          <path
            d="M3.75 13.5v3.75c0 .97.78 1.75 1.75 1.75h13c.97 0 1.75-.78 1.75-1.75V13.5h-4.5l-1 2h-5.5l-1-2z"
            stroke-linejoin="round"
          />
        </svg>
      </slot>
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
  </div>
</template>
