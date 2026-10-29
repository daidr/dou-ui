<script setup>
import { ref } from 'vue'

const users = Array.from({ length: 5000 }, (_, i) => ({
  value: i + 1,
  label: `用户 ${String(i + 1).padStart(4, '0')}`,
}))
const user = ref(4321)
</script>

<template>
  <DouSelect v-model="user" :options="users" virtual filterable />
</template>
