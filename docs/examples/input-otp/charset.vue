<script setup>
import { ref } from 'vue'

const invite = ref('')
</script>

<template>
  <DouInputOtp v-model="invite" type="alphanumeric" :length="8" :separator="4" size="sm" />
</template>
