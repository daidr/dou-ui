<script setup>
import { BellIcon, EditIcon, PlusIcon, SettingsIcon, TrashIcon } from '@dou-ui/icons'
import { ref } from 'vue'

// 点一下看完通知，数字变成 0 后按钮回到方形；再点一下又来了新通知
const unread = ref(3)
</script>

<template>
  <DouButton size="sm" variant="outline" aria-label="新建"><PlusIcon /></DouButton>
  <DouButton variant="outline" aria-label="编辑"><EditIcon /></DouButton>
  <DouButton size="lg" variant="outline" aria-label="设置"><SettingsIcon /></DouButton>
  <DouButton variant="ghost" aria-label="设置"><SettingsIcon /></DouButton>
  <DouButton variant="soft" tone="danger" aria-label="删除"><TrashIcon /></DouButton>
  <DouButton loading aria-label="保存"><PlusIcon /></DouButton>
  <DouButton
    variant="outline"
    :aria-label="unread ? `通知，${unread} 条未读` : '通知'"
    @click="unread = unread ? 0 : 3"
  >
    <template #leading><BellIcon /></template>
    <span v-if="unread">{{ unread }}</span>
  </DouButton>
</template>
