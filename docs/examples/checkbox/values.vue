<script setup>
import { ref } from 'vue'

const subscribe = ref('off')
</script>

<template>
  <DouCheckbox v-model="subscribe" checked-value="on" unchecked-value="off">订阅周报</DouCheckbox>
  <DouText variant="tertiary" size="sm" mono>subscribe: {{ subscribe }}</DouText>
</template>
