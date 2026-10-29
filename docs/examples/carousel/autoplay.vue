<script setup lang="ts">
import { ref } from 'vue'

const current = ref(0)
const notes = ['戴兜 更新了「发布流程」看板', '构建在 2 分 14 秒内完成', '文档站已部署到预览环境']
</script>

<template>
  <DouCarousel
    v-model="current"
    autoplay
    :interval="3000"
    indicators="outside"
    arrows="never"
    style="width: 100%"
  >
    <DouCarouselItem v-for="note in notes" :key="note">
      <DouCard>
        <DouText>{{ note }}</DouText>
      </DouCard>
    </DouCarouselItem>
  </DouCarousel>
  <DouText variant="secondary" style="margin-top: 8px">当前：第 {{ current + 1 }} 条</DouText>
</template>
