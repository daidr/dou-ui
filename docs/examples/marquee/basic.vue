<script setup>
import { MegaphoneIcon } from '@dou-ui/icons'

const notices = ['今晚 22:00 起系统维护一小时', '上海机房扩容完成', '新版本 0.20 已发布']
</script>

<template>
  <DouMarquee>
    <DouText v-for="notice in notices" :key="notice" class="notice">
      <DouIcon><MegaphoneIcon /></DouIcon>
      {{ notice }}
    </DouText>
  </DouMarquee>
</template>

<style scoped>
.notice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
</style>
