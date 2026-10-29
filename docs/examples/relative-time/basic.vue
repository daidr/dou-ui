<script setup>
const now = Date.now()
const minute = 60_000
const activities = [
  { user: '戴兜', action: '发布了 dou-docs', at: now - 20_000 },
  { user: '戴兜', action: '合并了 #128', at: now - 12 * minute },
  { user: '戴兜', action: '更新了上海区域的副本数', at: now - 5 * 60 * minute },
  { user: '戴兜', action: '创建了 dou-cron', at: now - 26 * 60 * minute },
  { user: '戴兜', action: '计划了一次维护', at: now + 2 * 24 * 60 * minute },
]
</script>

<template>
  <ul class="activity">
    <li v-for="item in activities" :key="item.action">
      <DouText>
        <DouText weight="medium">{{ item.user }}</DouText>
        {{ item.action }}
      </DouText>
      <DouText variant="tertiary" size="sm"><DouRelativeTime :value="item.at" /></DouText>
    </li>
  </ul>
</template>

<style scoped>
.activity {
  display: grid;
  gap: 10px;
  width: 100%;
  max-width: 420px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.activity li {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
</style>
