<script setup>
import { DouChart, DouChartBar } from '@dou-ui/chart'

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
</script>

<template>
  <DouChart :data="rows" x="day" :height="300">
    <DouChartBar y="search" name="搜索" stack />
    <DouChartBar y="ads" name="广告" stack />
    <DouChartBar y="invite" name="邀请" stack />
  </DouChart>
</template>
