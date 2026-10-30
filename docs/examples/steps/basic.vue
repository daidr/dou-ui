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
  <DouSteps :direction="screen.sm ? 'horizontal' : 'vertical'" :items="items" :current="current" />
  <DouSpace>
    <DouButton size="sm" variant="outline" :disabled="current === 0" @click="current--">
      上一步
    </DouButton>
    <DouButton size="sm" :disabled="current === 3" @click="current++">下一步</DouButton>
  </DouSpace>
</template>
