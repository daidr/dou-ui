<script setup>
import { ref } from 'vue'

const keyword = ref('组件')
</script>

<template>
  <DouInput v-model="keyword" placeholder="输入关键词" style="max-width: 240px" />
  <DouText>
    <DouHighlight
      text="DouUI 是戴兜为自己写的 Vue 3 组件库，组件按用途分组，每个组件都有亮色与暗色两套样式。"
      :keywords="keyword"
    />
  </DouText>
</template>
