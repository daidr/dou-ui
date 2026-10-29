<script setup>
import { ref } from 'vue'

const accent = ref('oklch(0.62 0.17 255)')
const tint = ref('rgb(46 125 91 / 0.6)')
const presets = ['#1f2328', '#3f56b5', '#2e7d5b', '#a8572d', '#b23a48', '#7a4fb5']
</script>

<template>
  <DouColorPanel v-model="accent" format="oklch" :panel="['square', 'wheel', 'oklch']" />
  <DouColorPanel v-model="tint" format="rgb" show-alpha :show-input="false" :presets="presets" />
</template>
