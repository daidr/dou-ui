<script setup>
import { ref } from 'vue'

const password = ref('dou-ui-2026')
</script>

<template>
  <DouInput v-model="password" type="password" show-password style="width: 240px" />
</template>
