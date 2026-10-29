<script setup>
import { computed, ref } from 'vue'

const services = [
  { name: 'dou-api', data: [820, 860, 900, 880, 940, 990, 960, 1020] },
  { name: 'dou-docs', data: [210, 230, 220, 260, 250, 270, 240, 280] },
  { name: 'dou-mail', data: [24, 30, 22, 28, 35, 26, 31, 29] },
]
const shared = ref(true)
const max = computed(() => Math.max(...services.flatMap((service) => service.data)))
</script>

<template>
  <div class="scale-demo">
    <DouSwitch v-model="shared">共用刻度</DouSwitch>
    <div v-for="service in services" :key="service.name" class="scale-demo__row">
      <DouText mono>{{ service.name }}</DouText>
      <DouSparkline
        :data="service.data"
        type="area"
        :min="shared ? 0 : undefined"
        :max="shared ? max : undefined"
        :width="160"
      />
      <DouText variant="secondary">{{ service.data.at(-1) }} 次/分</DouText>
    </div>
  </div>
</template>

<style scoped>
.scale-demo {
  display: grid;
  gap: 12px;
}

.scale-demo__row {
  display: grid;
  grid-template-columns: 96px auto auto;
  align-items: center;
  justify-content: start;
  gap: 16px;
}
</style>
