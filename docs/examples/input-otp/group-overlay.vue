<script setup>
import { ref } from 'vue'

const pin = ref('')
</script>

<template>
  <DouInputOtp v-model="pin" :length="6" :separator="3" mask />
</template>
