<script setup>
import { ref } from 'vue'

const sync = ref(false)
const saving = ref(false)
function toggleSync(value) {
  saving.value = true
  setTimeout(() => {
    sync.value = value
    saving.value = false
  }, 1200)
}
</script>

<template>
  <DouSwitch :model-value="sync" :loading="saving" @update:model-value="toggleSync">
    云端同步
  </DouSwitch>
  <DouSwitch disabled>禁用</DouSwitch>
  <DouSwitch disabled :model-value="true">禁用且打开</DouSwitch>
</template>
