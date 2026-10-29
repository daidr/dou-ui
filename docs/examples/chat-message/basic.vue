<script setup>
const question = [{ type: 'text', text: '上海今天要带伞吗？' }]
const answer = [
  { type: 'reasoning', text: '需要查今天上海的降雨时段。', duration: 2 },
  {
    type: 'tool',
    name: 'get_weather',
    input: { city: '上海', date: '今天' },
    output: { weather: '小雨转阴', rain: '14:00 – 17:00' },
  },
  { type: 'text', text: '要带。今天下午两点到五点有小雨，傍晚转阴。' },
]
</script>

<template>
  <DouChatMessage sender="user" :parts="question" />
  <DouChatMessage :parts="answer" />
</template>
