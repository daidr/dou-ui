<script setup lang="ts">
defineOptions({ name: 'DouGridLayoutHandle' })

withDefaults(
  defineProps<{
    /** The element to render, such as `header`. */
    as?: string
  }>(),
  { as: 'div' },
)
defineSlots<{ default?: () => unknown }>()
</script>

<template>
  <component :is="as" class="dou-grid-layout__handle" data-dou-grid-handle>
    <slot />
  </component>
</template>
