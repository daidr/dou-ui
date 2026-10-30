<script setup>
import { ref } from 'vue'

const presets = [
  { label: '淡入', value: 'dou-fade' },
  { label: '缩放', value: 'dou-zoom' },
  { label: '上移', value: 'dou-slide-up' },
  { label: '下移', value: 'dou-slide-down' },
]
const preset = ref('dou-zoom')
const shown = ref(true)
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 16px; max-width: 100%">
    <DouSpace size="sm" wrap>
      <DouSegmentedControl v-model="preset" :options="presets" size="sm" />
      <DouButton size="sm" variant="outline" @click="shown = !shown">
        {{ shown ? '隐藏' : '显示' }}
      </DouButton>
    </DouSpace>
    <div style="height: 88px">
      <Transition :name="preset">
        <DouCard v-if="shown" style="width: 280px; max-width: 100%"
          >本月用量已达到额度的 80%。</DouCard
        >
      </Transition>
    </div>
  </div>
</template>
