<script setup lang="ts">
import { ref } from 'vue'

const live = ref(true)
</script>

<template>
  <DouSwitch v-model="live">涟漪</DouSwitch>
  <DouStatusDot tone="success" :ripple="live">直播中</DouStatusDot>
  <DouStatusDot tone="primary" :ripple="live">正在构建</DouStatusDot>
  <DouStatusDot tone="danger" :ripple="live">告警未处理</DouStatusDot>
</template>
