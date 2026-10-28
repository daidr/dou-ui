<script setup lang="ts">
import { InboxIcon } from '@dou-ui/icons'
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
        <InboxIcon />
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
