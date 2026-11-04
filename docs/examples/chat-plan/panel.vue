<template>
  <DouChatPlan
    title="周报整理"
    :collapsible="false"
    :items="[
      { label: '汇总本周提交', status: 'done' },
      { label: '整理上海办公室的反馈', status: 'running' },
      { label: '生成图表' },
      { label: '发给戴兜确认' },
    ]"
  />
</template>
