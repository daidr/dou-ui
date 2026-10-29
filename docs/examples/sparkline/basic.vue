<script setup>
const visits = [12, 18, 15, 22, 19, 28, 24, 31, 27, 35, 30, 26]
const latency = [180, 160, 172, 140, 152, 128, 136, 120, 126, 118, 124, 112]
const errors = [3, 1, 0, 4, 2, 6, 1, 0, 2, 5, 1, 3]
</script>

<template>
  <div class="sparkline-demo">
    <div>
      <DouText size="sm" variant="secondary">访问量</DouText>
      <DouSparkline :data="visits" :markers="['min', 'max', 'last']" />
    </div>
    <div>
      <DouText size="sm" variant="secondary">响应时间</DouText>
      <DouSparkline :data="latency" type="area" tone="success" smooth />
    </div>
    <div>
      <DouText size="sm" variant="secondary">错误数</DouText>
      <DouSparkline :data="errors" type="bar" tone="danger" />
    </div>
  </div>
</template>

<style scoped>
.sparkline-demo {
  display: flex;
  flex-wrap: wrap;
  gap: 32px;
}

.sparkline-demo > div {
  display: grid;
  gap: 8px;
}
</style>
