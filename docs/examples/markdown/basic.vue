<script setup>
const content = `## 周末去徐汇滨江

从**龙美术馆**出发，沿江骑行到西岸美术馆，全程约 4 公里，路很平，适合慢慢骑。

- 租车点：龙腾大道沿线都有
- 建议时间：*下午四点以后*，可以看日落
- [ ] 带上水和防晒

| 地点 | 距离 | 停留 |
| :-- | --: | :-: |
| 龙美术馆 | 0 km | 1 小时 |
| 油罐艺术中心 | 1.8 km | 40 分钟 |
| 西岸美术馆 | 4.1 km | 1 小时 |

> 周六下午可能有阵雨，出门前看一眼[天气预报](https://weather.example.com)。

更多路线见 https://ride.example.com/xuhui。`
</script>

<template>
  <DouMarkdown :content="content" />
</template>
