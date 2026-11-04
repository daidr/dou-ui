<template>
  <DouChatPlan
    title="迁移计划"
    :items="[
      { label: '备份数据库', status: 'done' },
      { label: '升级依赖', description: '有 2 个包需要手动处理', status: 'error' },
      { label: '更新文档', status: 'skipped' },
      { label: '等待戴兜确认上线时间', status: 'waiting' },
      { label: '发布新版本' },
    ]"
  />
</template>
