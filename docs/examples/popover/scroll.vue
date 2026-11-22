<script setup>
const tasks = Array.from({ length: 16 }, (_, index) => ({
  id: index + 1,
  name: `任务 #${index + 1}`,
  detail: index % 3 === 0 ? '运行中' : '已完成',
}))
</script>

<template>
  <DouPopover title="后台任务" :width="260" :max-height="220" placement="bottom-start">
    <DouButton variant="outline">查看任务列表</DouButton>
    <template #content>
      <div style="display: flex; flex-direction: column; gap: 6px">
        <div
          v-for="task in tasks"
          :key="task.id"
          style="display: flex; justify-content: space-between; font-size: 13px"
        >
          <span>{{ task.name }}</span>
          <DouText variant="tertiary" size="sm">{{ task.detail }}</DouText>
        </div>
      </div>
    </template>
  </DouPopover>
</template>
