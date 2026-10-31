<script setup>
import { DouChart, DouChartBar, DouChartTooltip } from '@dou-ui/chart'

// 一周内每天按渠道的新增用户
const rows = [
  { day: '周一', search: 320, ads: 180, invite: 90 },
  { day: '周二', search: 300, ads: 210, invite: 110 },
  { day: '周三', search: 345, ads: 190, invite: 102 },
  { day: '周四', search: 330, ads: 240, invite: 125 },
  { day: '周五', search: 380, ads: 260, invite: 140 },
  { day: '周六', search: 290, ads: 310, invite: 182 },
  { day: '周日', search: 270, ads: 290, invite: 196 },
]

const total = (items) => items.reduce((sum, item) => sum + item.value, 0)
const share = (item, items) => `${Math.round((item.value / total(items)) * 100)}%`
</script>

<template>
  <DouChart :data="rows" x="day" :height="300">
    <DouChartBar y="search" name="搜索" stack />
    <DouChartBar y="ads" name="广告" stack />
    <DouChartBar y="invite" name="邀请" stack />
    <DouChartTooltip v-slot="{ title, items }">
      <div class="tip-title">{{ title }} 新增 {{ total(items) }} 人</div>
      <div v-for="item in items" :key="item.name" class="tip-row">
        <span class="tip-swatch" :style="{ background: item.color }" />
        <span class="tip-name">{{ item.name }}</span>
        <span>{{ item.text }}</span>
        <span class="tip-share">{{ share(item, items) }}</span>
      </div>
    </DouChartTooltip>
  </DouChart>
</template>

<style scoped>
.tip-title {
  margin-bottom: 6px;
  color: var(--dou-color-text);
  font-weight: var(--dou-font-weight-medium);
}

.tip-row {
  display: flex;
  gap: 6px;
  align-items: center;
  line-height: 20px;
}

.tip-swatch {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.tip-name {
  flex: 1;
  margin-right: 12px;
}

.tip-share {
  width: 36px;
  color: var(--dou-color-text-tertiary);
  text-align: right;
}
</style>
