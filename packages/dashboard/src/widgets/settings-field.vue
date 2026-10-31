<script setup lang="ts">
defineOptions({ name: 'DouDashboardSettingsField' })

defineProps<{ label: string; hint?: string }>()
</script>

<template>
  <div class="dou-dashboard__field">
    <span class="dou-dashboard__field-label">{{ label }}</span>
    <slot />
    <span v-if="hint" class="dou-dashboard__field-hint">{{ hint }}</span>
  </div>
</template>
