<script setup>
import { useDashboardWidget } from '@dou-ui/dashboard'

const { props } = useDashboardWidget()
</script>

<template>
  <p class="note">{{ props.text }}</p>
</template>

<style scoped>
.note {
  margin: 0;
  color: var(--dou-color-text-secondary);
  line-height: var(--dou-font-line-height);
  white-space: pre-wrap;
}
</style>
