<script setup>
const notes = [
  { id: 1, title: '周一例会', text: '确认第 22 批的范围，季度选择和瀑布流排在本周。' },
  {
    id: 2,
    title: '设计走查',
    text: '表单动态字段的示例里，删除按钮改成图标按钮，并补上读屏标签。卡片之间的间距统一为 12px。',
  },
  { id: 3, title: '待办', text: '整理断点文档。' },
  {
    id: 4,
    title: '上海出差',
    text: '周四上午拜访客户，下午回公司。车票已订，酒店离会场步行十分钟。记得带上演示用的平板和转接头。',
  },
  { id: 5, title: '读书笔记', text: '先写最窄屏幕上的样式，再在更宽的断点上覆盖。' },
  { id: 6, title: '备忘', text: '周五前提交报销单，附上发票的照片。' },
  {
    id: 7,
    title: '发布清单',
    text: '更新路线图与更新日志，跑完全部检查，截图发给戴兜确认后再合并。',
  },
  { id: 8, title: '想法', text: '语言包加一份繁体中文。' },
]
</script>

<template>
  <DouMasonry :items="notes" item-key="id" :columns="{ base: 1, sm: 2, md: 3 }">
    <template #default="{ item }">
      <DouCard :title="item.title" padding="sm">
        <DouText variant="secondary" size="sm">{{ item.text }}</DouText>
      </DouCard>
    </template>
  </DouMasonry>
</template>
