<script setup lang="ts">
import { ref } from 'vue'

const volume = ref(40)
const price = ref<[number, number]>([200, 800])
</script>

<template>
  <div style="display: grid; gap: 40px; width: 100%; max-width: 360px; padding-top: 32px">
    <DouSlider v-model="volume" tooltip :format-value="(v: number) => `${v}%`" aria-label="音量" />
    <DouSlider
      v-model="price"
      range
      tooltip="always"
      :min="0"
      :max="1000"
      :step="50"
      :format-value="(v: number) => `¥${v}`"
      aria-label="价格"
    />
  </div>
</template>
