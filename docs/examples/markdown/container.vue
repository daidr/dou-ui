<script setup>
const content = `:::tip 出行建议
周六上午**多云**，适合去滨江骑行。
:::

:::warning
下午有小雨，记得带伞。
:::

:::weather 上海 · 周六
- 最高 24 度，最低 18 度
- 东南风 3 级
:::`
</script>

<template>
  <DouMarkdown :content="content">
    <template #container-weather="{ title, children }">
      <div class="weather">
        <div class="weather-title">{{ title }}</div>
        <component :is="children" />
      </div>
    </template>
  </DouMarkdown>
</template>

<style scoped>
.weather {
  padding: 12px 16px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
}

.weather-title {
  font-weight: var(--dou-font-weight-medium);
}
</style>
