<script setup>
const notes = [
  '上海机房完成扩容。',
  '发布流程改为先灰度百分之五，观察半小时没有异常后再全量。',
  '数据库连接池上限调到 200，夜间任务改到凌晨两点之后执行，避开备份窗口；同时给慢查询加了告警，超过一秒的语句会通知值班同学。',
]
const rows = Array.from({ length: 10000 }, (_, index) => ({
  id: index,
  title: `变更 #${index}`,
  note: notes[(index * 7) % 3],
}))
</script>

<template>
  <DouCard padding="none">
    <DouVirtualList :items="rows" item-key="id" :estimate-size="64" :height="320">
      <template #default="{ item }">
        <div class="vl-note">
          <DouText weight="medium">{{ item.title }}</DouText>
          <DouText variant="secondary" size="sm">{{ item.note }}</DouText>
        </div>
      </template>
    </DouVirtualList>
  </DouCard>
</template>

<style>
.vl-note {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--dou-color-border-subtle);
}
</style>
