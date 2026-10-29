<script setup>
import { ref } from 'vue'

const notify = ref(true)
</script>

<template>
  <DouSwitch v-model="notify">接收通知</DouSwitch>
</template>
