<script setup>
import { SaveIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const last = ref('无')
</script>

<template>
  <div class="row">
    <DouDropdownButton
      variant="solid"
      tone="primary"
      @click="last = '保存'"
      @select="(value) => (last = value)"
    >
      <template #leading>
        <DouIcon><SaveIcon /></DouIcon>
      </template>
      保存
      <template #menu>
        <DouDropdownItem value="保存为草稿">保存为草稿</DouDropdownItem>
        <DouDropdownItem value="另存为模板">另存为模板</DouDropdownItem>
      </template>
    </DouDropdownButton>
    <DouDropdownButton @click="last = '合并'" @select="(value) => (last = value)">
      合并
      <template #menu>
        <DouDropdownItem value="压缩后合并">压缩后合并</DouDropdownItem>
        <DouDropdownItem value="变基后合并">变基后合并</DouDropdownItem>
      </template>
    </DouDropdownButton>
    <DouDropdownButton size="sm" variant="soft" disabled>已禁用</DouDropdownButton>
  </div>
  <DouText variant="tertiary" size="sm">最近的操作：{{ last }}</DouText>
</template>

<style scoped>
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
</style>
