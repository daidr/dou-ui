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
const current = ref('overview')
const target = ref()
const last = ref('无')
</script>

<template>
  <DouContextMenu
    v-model:target="target"
    :before-open="() => !!target"
    @select="(value) => (last = `${value}「${target.label}」`)"
  >
    <DouMenu
      v-model="current"
      :items="items"
      style="width: 220px"
      @item-contextmenu="(item) => (target = item)"
    />
    <template #menu>
      <DouDropdownItem value="在新标签页打开">在新标签页打开</DouDropdownItem>
      <DouDropdownItem value="复制链接">复制链接</DouDropdownItem>
      <DouDropdownItem value="固定到顶部">固定到顶部</DouDropdownItem>
    </template>
  </DouContextMenu>
  <DouText variant="tertiary" size="sm">最近的操作：{{ last }}</DouText>
</template>
