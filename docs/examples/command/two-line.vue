<script setup>
import { FileTextIcon, HashIcon, MessagesIcon, UserIcon } from '@dou-ui/icons'
import { markRaw } from 'vue'

const icons = markRaw({
  thread: MessagesIcon,
  doc: FileTextIcon,
  channel: HashIcon,
  person: UserIcon,
})
const items = [
  {
    value: 't1',
    label: '上海办公室搬迁时间',
    kind: 'thread',
    group: '讨论',
    description: '#行政 · 戴兜 · 昨天 18:20',
  },
  {
    value: 't2',
    label: '周五发版前的回归清单',
    kind: 'thread',
    group: '讨论',
    description: '#前端 · 3 条回复 · 今天 10:05',
  },
  {
    value: 'd1',
    label: '新人入职指南',
    kind: 'doc',
    group: '文档',
    description: '从领电脑到第一次提交代码，按天排好的待办',
  },
  { value: 'c1', label: '前端', kind: 'channel', group: '频道', description: '42 位成员' },
  { value: 'p1', label: '戴兜', kind: 'person', group: '成员', description: '上海 · 设计' },
]
</script>

<template>
  <DouCard padding="none" style="max-width: 520px">
    <DouCommand :items="items" placeholder="搜索讨论、文档和成员">
      <template #item="{ item }">
        <DouIcon class="two-line__icon"><component :is="icons[item.kind]" /></DouIcon>
        <span class="two-line__text">
          <span class="two-line__title">{{ item.label }}</span>
          <span class="two-line__meta">{{ item.description }}</span>
        </span>
      </template>
    </DouCommand>
  </DouCard>
</template>

<style scoped>
.two-line__icon {
  flex-shrink: 0;
  color: var(--dou-color-text-tertiary);
}
.two-line__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.two-line__title,
.two-line__meta {
  overflow-x: clip;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.two-line__title {
  line-height: 20px;
}
.two-line__meta {
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
  line-height: 18px;
}
</style>
