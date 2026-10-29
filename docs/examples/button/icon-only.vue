<script setup>
import { EditIcon, PlusIcon, SettingsIcon, TrashIcon } from '@dou-ui/icons'
</script>

<template>
  <DouButton size="sm" variant="outline" aria-label="新建"><PlusIcon /></DouButton>
  <DouButton variant="outline" aria-label="编辑"><EditIcon /></DouButton>
  <DouButton size="lg" variant="outline" aria-label="设置"><SettingsIcon /></DouButton>
  <DouButton variant="ghost" aria-label="设置"><SettingsIcon /></DouButton>
  <DouButton variant="soft" tone="danger" aria-label="删除"><TrashIcon /></DouButton>
  <DouButton loading aria-label="保存"><PlusIcon /></DouButton>
</template>
