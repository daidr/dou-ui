<script setup lang="ts">
import { ref } from 'vue'

const steps = ['拉取代码', '安装依赖', '类型检查', '运行测试', '构建', '部署预览'].map(
  (label, i) => ({ key: i + 1, label }),
)
const order = ref<'original' | 'push' | 'unshift'>('original')
const chosen = ref([2, 5])
</script>

<template>
  <DouSpace direction="vertical" align="start">
    <DouSegmentedControl
      v-model="order"
      :options="[
        { value: 'original', label: '原顺序' },
        { value: 'push', label: '追加到末尾' },
        { value: 'unshift', label: '插到开头' },
      ]"
    />
    <DouTransfer
      v-model="chosen"
      :data="steps"
      :target-order="order"
      :titles="['可选步骤', '流水线']"
    />
  </DouSpace>
</template>
