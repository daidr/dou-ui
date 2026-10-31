<script setup>
import { ref } from 'vue'

const status = ref('paused')
</script>

<template>
  <DouSwitch v-model="status" checked-value="running" unchecked-value="paused">
    定时任务
  </DouSwitch>
  <DouText variant="tertiary" size="sm" mono>status: {{ status }}</DouText>
</template>
