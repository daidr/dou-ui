<script setup>
import { useBreakpoints } from 'dou-ui'
import { ref } from 'vue'

// four steps do not fit side by side on a phone
const screen = useBreakpoints()

const current = ref(1)
const items = [
  { title: '拉取代码', description: '从 main 分支' },
  { title: '构建', description: '安装依赖并打包' },
  { title: '部署', description: '上传到边缘节点' },
  { title: '完成' },
]
</script>

<template>
  <DouSteps
    :direction="screen.sm ? 'horizontal' : 'vertical'"
    v-model:current="current"
    :items="items"
    clickable
  />
</template>
