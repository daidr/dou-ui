<script setup>
const sources = [
  {
    title: '西岸美术馆 · 当季展览',
    url: 'https://westbund.example.com/exhibitions',
    description: '本季展出两组装置作品，周一闭馆。',
  },
  { title: '上海博物馆东馆参观指南', url: 'https://museum.example.com/guide' },
  { title: '周末看展清单', site: '城市周刊' },
  { title: '徐汇滨江地图', url: 'https://map.example.com/xuhui' },
]
</script>

<template>
  <p class="text">
    西岸美术馆本季有两组装置作品<DouChatCitation :index="1" :source="sources[0]" />，周一闭馆；
    上海博物馆东馆需要提前预约<DouChatCitation :index="2" :source="sources[1]" />。
  </p>
  <DouChatSources :items="sources" :max="3" />
</template>

<style scoped>
.text {
  margin: 0;
}
</style>
