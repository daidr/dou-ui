<script setup lang="ts">
import { ref } from 'vue'

const on = ref(false)
</script>

<template>
  <DouSwitch v-model="on">整页水印</DouSwitch>
  <DouWatermark v-if="on" content="戴兜" fullscreen :z-index="3000" />
</template>
