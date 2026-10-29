<script setup>
const items = [
  { title: '拉取代码', description: '从 main 分支' },
  { title: '构建', description: '安装依赖并打包' },
  { title: '部署', description: '上传到边缘节点' },
  { title: '完成' },
]
</script>

<template>
  <DouSteps :items="items" :current="2" status="error" direction="vertical" />
  <DouSteps :items="items" :current="2" direction="vertical" size="sm" />
</template>
