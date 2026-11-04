<template>
  <DouChatToolCall
    name="get_weather"
    :input="{ city: '上海', date: '2026-10-31' }"
    :output="{ weather: '多云', high: 24, low: 18, wind: '东北风 2 级' }"
  />
  <DouChatToolCall title="正在搜索：上海 滨江 骑行路线" status="running" />
  <DouChatToolCall name="read_file" status="pending" :input="{ path: 'notes/上次骑行记录.gpx' }" />
  <DouChatToolCall
    name="read_file"
    status="error"
    :input="{ path: 'notes/旅行计划.md' }"
    output="文件不存在"
  />
</template>
