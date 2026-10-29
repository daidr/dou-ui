<script setup>
import { ref } from 'vue'

const color = ref('#3f56b5')
</script>

<template>
  <DouColorPicker v-model="color" />
  <DouText variant="tertiary" size="sm">{{ color }}</DouText>
</template>
