<script setup>
const usage = [
  { label: '图片', value: 18.2 },
  { label: '视频', value: 31.5 },
  { label: '文档', value: 6.4 },
  { label: '其他', value: 3.9 },
]
</script>

<template>
  <DouProgressGroup
    :items="usage"
    :max="100"
    legend
    label="存储空间"
    :format="(value) => `${value} GB`"
  />
</template>
