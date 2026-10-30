<script setup>
import { ref } from 'vue'

const open = ref(false)
const snap = ref()
const stops = [
  { time: '08:30', place: '上海虹桥站', note: '取票后在 B 区候车' },
  { time: '09:05', place: 'G7012 次列车', note: '7 车 12F' },
  { time: '10:20', place: '杭州东站', note: '出站后打车' },
  { time: '11:00', place: '西溪园区', note: '与产品组碰需求' },
  { time: '12:30', place: '园区食堂', note: '' },
  { time: '14:00', place: '西溪园区', note: '评审新版仪表盘' },
  { time: '17:40', place: '杭州东站', note: 'G7375 次列车' },
  { time: '18:50', place: '上海虹桥站', note: '' },
]
</script>

<template>
  <DouButton variant="outline" @click="open = true">查看行程</DouButton>
  <DouText variant="tertiary" size="sm">当前停靠：{{ snap ?? '—' }}</DouText>
  <DouDrawer
    v-model:open="open"
    v-model:snap="snap"
    placement="bottom"
    title="戴兜的出差行程"
    swipeable
    :snap-points="['40%', '90%']"
  >
    <DouTimeline>
      <DouTimelineItem
        v-for="stop in stops"
        :key="stop.time + stop.place"
        :time="stop.time"
        :title="stop.place"
      >
        {{ stop.note }}
      </DouTimelineItem>
    </DouTimeline>
    <template #footer="{ close }">
      <DouButton variant="outline" @click="close">关闭</DouButton>
      <DouButton @click="close">导出到日历</DouButton>
    </template>
  </DouDrawer>
</template>
