<script setup>
import { ref } from 'vue'

const direction = ref('vertical')
const directions = [
  { value: 'vertical', label: '从上到下' },
  { value: 'horizontal', label: '从左到右' },
]
const nodes = [
  { id: 'pull', label: '拉取代码', status: 'finish' },
  { id: 'install', label: '安装依赖', status: 'finish' },
  { id: 'lint', label: '代码检查', status: 'finish' },
  { id: 'test', label: '单元测试', status: 'process', extra: '3 分钟' },
  { id: 'types', label: '类型检查', status: 'finish' },
  { id: 'build', label: '构建', status: 'process' },
  { id: 'image', label: '打包镜像' },
  { id: 'sh', label: '部署上海' },
  { id: 'bj', label: '部署北京' },
  { id: 'release', label: '发布完成', kind: 'milestone' },
]
const edges = [
  { from: 'pull', to: 'install' },
  { from: 'install', to: 'lint' },
  { from: 'install', to: 'test' },
  { from: 'install', to: 'types' },
  { from: 'lint', to: 'build' },
  { from: 'test', to: 'build' },
  { from: 'types', to: 'build' },
  { from: 'build', to: 'image' },
  { from: 'image', to: 'sh' },
  { from: 'image', to: 'bj' },
  { from: 'sh', to: 'release' },
  { from: 'bj', to: 'release' },
]
</script>

<template>
  <DouSegmentedControl
    v-model="direction"
    :options="directions"
    size="sm"
    style="margin-bottom: 12px"
  />
  <DouNodeGraph :nodes="nodes" :edges="edges" :direction="direction" />
</template>
