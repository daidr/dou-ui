<script setup>
import { ref } from 'vue'

const stepped = ref('10:00')
</script>

<template>
  <DouTimePicker v-model="stepped" :minute-step="15" style="width: 140px" />
</template>
