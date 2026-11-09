<template>
  <DouChatMessage sender="user" content="周六去滴水湖，帮我看看天气。">
    <template #trailing>
      {{ ' ' }}
      <DouPopover title="原来的消息" content="周六去淀山湖，帮我看看天气。">
        <DouLink class="trailing-demo__mark" underline="hover">已编辑</DouLink>
      </DouPopover>
    </template>
  </DouChatMessage>
  <DouChatMessage
    markdown
    actions-visible="hover"
    content="周六上海**多云转晴**，18–24℃，东南风 3 级，适合骑车绕湖一圈。"
  >
    <template #trailing>
      {{ ' ' }}
      <DouPopover
        title="改动理由"
        content="戴兜把目的地从淀山湖改成了滴水湖，按新地点重新查了天气。"
      >
        <DouLink class="trailing-demo__mark" underline="hover">已编辑</DouLink>
      </DouPopover>
    </template>
  </DouChatMessage>
</template>

<style scoped>
/* a quiet mark, with taps taken from 40px around it on touch screens */
.trailing-demo__mark {
  --dou-link-tone: var(--dou-color-text-tertiary);
  position: relative;
  font-size: var(--dou-font-size-sm);
  font-weight: inherit;
}
@media (pointer: coarse) {
  .trailing-demo__mark::after {
    position: absolute;
    inset: min(0px, calc(50% - 20px));
    content: '';
  }
}
</style>
