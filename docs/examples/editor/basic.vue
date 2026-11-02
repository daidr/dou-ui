<script setup>
import { DouEditor } from '@dou-ui/editor'
import { ref } from 'vue'

const doc = ref({
  version: 1,
  blocks: [
    { type: 'heading', props: { level: 1 }, content: '上海周末出行计划' },
    {
      content: [
        { type: 'text', text: '戴兜整理，周五晚上出发。行程以' },
        { type: 'text', text: '轻松', marks: ['bold'] },
        { type: 'text', text: '为主，每天最多安排两个地方。' },
      ],
    },
    { type: 'heading', props: { level: 2 }, content: '行程' },
    {
      type: 'numberedItem',
      content: '周六上午：武康路散步',
      children: [
        { type: 'bulletItem', content: '沿路找一家咖啡店坐坐' },
        { type: 'bulletItem', content: '中午去附近吃本帮菜' },
      ],
    },
    { type: 'numberedItem', content: '周六下午：上海博物馆东馆' },
    { type: 'numberedItem', content: '周日：西岸美术馆，傍晚在滨江骑车' },
    { type: 'heading', props: { level: 2 }, content: '出发前' },
    { type: 'checkItem', props: { checked: true }, content: '订好周五晚上的车票' },
    { type: 'checkItem', content: '提前预约博物馆' },
    { type: 'checkItem', content: '带上充电宝和雨伞' },
    { type: 'quote', content: '天气预报说周日有小雨，骑车的安排可以挪到周六晚上。' },
  ],
})
</script>

<template>
  <DouEditor v-model="doc" aria-label="出行计划" />
</template>
