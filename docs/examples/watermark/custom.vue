<script setup lang="ts">
import { ref } from 'vue'

const rotate = ref(-22)
const gap = ref(80)
const staggered = ref(true)
</script>

<template>
  <DouSpace direction="vertical" style="width: 100%">
    <DouSpace wrap>
      <DouText variant="secondary">旋转</DouText>
      <DouSlider v-model="rotate" :min="-90" :max="90" style="width: 160px" />
      <DouText variant="secondary">间距</DouText>
      <DouSlider v-model="gap" :min="20" :max="160" style="width: 160px" />
      <DouCheckbox v-model="staggered">交错排布</DouCheckbox>
    </DouSpace>
    <DouWatermark
      content="戴兜 2026-10-29"
      :rotate="rotate"
      :gap="[gap, gap]"
      :staggered="staggered"
      :font="{ size: 13, weight: 600 }"
      color="var(--dou-color-primary)"
      :opacity="0.16"
      style="width: 100%"
    >
      <div style="height: 200px" />
    </DouWatermark>
  </DouSpace>
</template>
