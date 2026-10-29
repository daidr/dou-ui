<script setup>
import { ref } from 'vue'

const color = ref('#3f56b5')
</script>

<template>
  <DouColorPanel v-model="color" />
  <DouText variant="secondary" mono>{{ color }}</DouText>
</template>
