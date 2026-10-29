<script setup>
import { ref } from 'vue'

const date = ref('2026-10-29')
const datetime = ref(null)
</script>

<template>
  <DouInputDate v-model="date" picker style="width: 170px" />
  <DouInputDate v-model="datetime" type="datetime" picker style="width: 210px" />
</template>
