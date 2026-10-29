<script setup>
import { ref } from 'vue'

const bass = ref(30)
const mid = ref(55)
const treble = ref(70)
const range = ref([20, 80])
const marks = { 0: '0', 50: '50', 100: '100' }
</script>

<template>
  <div class="row">
    <DouSlider v-model="bass" vertical aria-label="低音" />
    <DouSlider v-model="mid" vertical aria-label="中音" />
    <DouSlider v-model="treble" vertical aria-label="高音" />
    <DouSlider v-model="range" vertical range :marks="marks" :height="200" />
  </div>
</template>

<style scoped>
.row {
  display: flex;
  gap: 24px;
}
</style>
