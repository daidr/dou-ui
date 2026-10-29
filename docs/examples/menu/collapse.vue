<script setup>
import { CubeIcon, DashboardIcon, FileTextIcon, GlobeIcon, UsersIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const items = [
  { key: 'overview', label: '概览', icon: DashboardIcon },
  {
    key: 'deployments',
    label: '部署',
    icon: CubeIcon,
    children: [
      { key: 'production', label: '生产环境' },
      { key: 'preview', label: '预览环境' },
      { key: 'rollback', label: '回滚记录', disabled: true },
    ],
  },
  { key: 'logs', label: '日志', icon: FileTextIcon },
  {
    type: 'group',
    label: '设置',
    children: [
      { key: 'domains', label: '域名', icon: GlobeIcon },
      { key: 'members', label: '成员', icon: UsersIcon },
    ],
  },
]
const current = ref('production')
const collapsed = ref(false)
</script>

<template>
  <DouMenu
    v-model="current"
    :items="items"
    :collapsed="collapsed"
    :style="{ width: collapsed ? 'auto' : '220px' }"
  />
  <DouButton size="sm" variant="outline" @click="collapsed = !collapsed">
    {{ collapsed ? '展开' : '折叠' }}
  </DouButton>
</template>
