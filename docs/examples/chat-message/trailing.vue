<template>
  <DouChatMessage sender="user" content="周六去滴水湖，帮我看看天气。">
    <template #trailing>
      <DouPopover title="原来的消息" content="周六去淀山湖，帮我看看天气。">
        <button type="button" class="trailing-demo__mark">已编辑</button>
      </DouPopover>
    </template>
  </DouChatMessage>
  <DouChatMessage
    markdown
    actions-visible="hover"
    content="周六上海**多云转晴**，18–24℃，东南风 3 级，适合骑车绕湖一圈。"
  >
    <template #trailing>
      <DouPopover
        title="改动理由"
        content="戴兜把目的地从淀山湖改成了滴水湖，按新地点重新查了天气。"
      >
        <button type="button" class="trailing-demo__mark">已编辑</button>
      </DouPopover>
    </template>
  </DouChatMessage>
</template>

<style scoped>
.trailing-demo__mark {
  margin-inline-start: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--dou-color-text-tertiary);
  font: inherit;
  font-size: var(--dou-font-size-sm);
  cursor: pointer;
}
.trailing-demo__mark:hover {
  color: var(--dou-color-text-secondary);
  text-decoration: underline;
}
</style>
