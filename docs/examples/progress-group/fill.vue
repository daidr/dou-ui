<script setup>
const votes = [
  { label: '赞成', value: 128, tone: 'success' },
  { label: '中立', value: 46, tone: 'neutral' },
  { label: '反对', value: 31, tone: 'danger' },
]
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 20px; width: 100%">
    <DouProgressGroup :items="votes" legend size="lg" label="投票结果" />
    <DouProgressGroup
      :items="[
        { label: '已完成', value: 12, color: '#0f766e' },
        { label: '进行中', value: 5, color: '#0ea5a4' },
      ]"
      :max="24"
      size="sm"
      legend
      :format="(value) => `${value} 项`"
    />
  </div>
</template>
