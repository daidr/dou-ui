<script setup>
import { BellIcon, CreditCardIcon, KeyIcon, UserIcon, UsersIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const items = [
  { key: 'profile', label: '个人资料', icon: UserIcon, description: '头像、昵称和联系方式' },
  {
    key: 'team',
    label: '团队',
    icon: UsersIcon,
    description: '上海办公室的 12 位成员',
    children: [
      { key: 'members', label: '成员', description: '邀请、移除成员和调整角色' },
      { key: 'roles', label: '角色', description: '每种角色能看到和修改的内容' },
    ],
  },
  {
    key: 'notifications',
    label: '通知',
    icon: BellIcon,
    description: '哪些动态发邮件提醒',
  },
  {
    type: 'group',
    label: '安全',
    children: [
      { key: 'tokens', label: '访问令牌', icon: KeyIcon, description: '给脚本和持续集成用的令牌' },
      { key: 'billing', label: '账单', icon: CreditCardIcon },
    ],
  },
]
const current = ref('members')
const collapsed = ref(false)
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 12px; align-items: flex-start">
    <DouButton size="sm" variant="outline" @click="collapsed = !collapsed">
      {{ collapsed ? '展开' : '折叠' }}
    </DouButton>
    <DouMenu
      v-model="current"
      :items="items"
      :collapsed="collapsed"
      :style="{ width: collapsed ? 'auto' : '240px' }"
    />
  </div>
</template>
