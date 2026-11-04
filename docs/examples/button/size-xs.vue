<script setup>
import { EditIcon, RefreshIcon, TrashIcon } from '@dou-ui/icons'
</script>

<template>
  <div class="demo-rows">
    <div class="demo-row">
      <span class="demo-row__text">戴兜 · 上海 · 周报已提交</span>
      <DouButton size="xs" variant="ghost">回复</DouButton>
      <DouTooltip content="编辑">
        <DouButton size="xs" variant="ghost" aria-label="编辑"><EditIcon /></DouButton>
      </DouTooltip>
      <DouTooltip content="删除">
        <DouButton size="xs" variant="ghost" tone="danger" aria-label="删除"
          ><TrashIcon
        /></DouButton>
      </DouTooltip>
    </div>
    <div class="demo-row">
      <span class="demo-row__text">构建失败 · 依赖下载超时</span>
      <DouButton size="xs" variant="ghost">查看日志</DouButton>
      <DouButton size="xs" variant="outline">
        <template #leading><RefreshIcon /></template>
        重试
      </DouButton>
    </div>
  </div>
</template>

<style scoped>
.demo-rows {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 420px;
}
.demo-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 6px 0 8px;
  border-bottom: 1px solid var(--dou-color-border);
  font-size: var(--dou-font-size-sm);
}
.demo-row__text {
  flex: 1;
  color: var(--dou-color-text-secondary);
}
</style>
