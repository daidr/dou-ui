<script setup>
import { ref } from 'vue'

const items = [
  { value: 'new', label: '新建项目', group: '操作', shortcut: 'mod+n' },
  {
    value: 'deploy',
    label: '部署到生产环境',
    group: '操作',
    keywords: ['deploy', 'release', '上线'],
    shortcut: 'mod+d',
  },
  { value: 'invite', label: '邀请成员', group: '操作' },
  { value: 'delete', label: '删除项目', group: '操作', disabled: true },
  { value: 'overview', label: 'Overview', group: '导航', description: '项目概览' },
  { value: 'deployments', label: 'Deployments', group: '导航', description: '部署记录' },
  { value: 'settings', label: 'Settings', group: '导航', description: '域名、环境变量与权限' },
  { value: 'docs', label: 'Documentation', group: '帮助' },
  { value: 'shortcuts', label: '键盘快捷键', group: '帮助', shortcut: '?' },
]
const last = ref('—')
const open = ref(false)
</script>

<template>
  <DouButton variant="outline" @click="open = true">
    打开命令面板
    <template #trailing><DouKbd size="sm">⌘</DouKbd><DouKbd size="sm">K</DouKbd></template>
  </DouButton>
  <DouText variant="tertiary" size="sm">上次执行：{{ last }}</DouText>
  <DouCommandDialog v-model:open="open" :items="items" @select="last = $event.label">
    <template #footer>
      <span><DouKbd size="sm">↑</DouKbd> <DouKbd size="sm">↓</DouKbd> 移动</span>
      <span><DouKbd size="sm">Enter</DouKbd> 执行</span>
      <span><DouKbd size="sm">Esc</DouKbd> 关闭</span>
    </template>
  </DouCommandDialog>
</template>
