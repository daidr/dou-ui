<script setup>
import { ref } from 'vue'

const presets = ['dou-fade', 'dou-zoom', 'dou-slide-up', 'dou-slide-down']
const preset = ref('dou-zoom')
const shown = ref(true)
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 16px">
    <DouSpace size="sm">
      <DouSegmentedControl v-model="preset" :options="presets" size="sm" />
      <DouButton size="sm" variant="outline" @click="shown = !shown">
        {{ shown ? '隐藏' : '显示' }}
      </DouButton>
    </DouSpace>
    <div style="height: 88px">
      <Transition :name="preset">
        <DouCard v-if="shown" style="width: 280px">本月用量已达到额度的 80%。</DouCard>
      </Transition>
    </div>
  </div>
</template>
