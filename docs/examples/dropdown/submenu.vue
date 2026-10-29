<script setup>
import { DownloadIcon, ShareIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const last = ref('无')
</script>

<template>
  <DouDropdown @select="(value) => (last = value)">
    <DouButton variant="outline">文件</DouButton>
    <template #menu>
      <DouDropdownItem value="重命名">重命名</DouDropdownItem>
      <DouDropdownItem value="创建副本">创建副本</DouDropdownItem>
      <DouDropdownSub title="导出为">
        <template #prefix>
          <DouIcon><DownloadIcon /></DouIcon>
        </template>
        <DouDropdownItem value="导出 PDF">PDF</DouDropdownItem>
        <DouDropdownItem value="导出 PNG">PNG 图片</DouDropdownItem>
        <DouDropdownSub title="表格">
          <DouDropdownItem value="导出 CSV">CSV</DouDropdownItem>
          <DouDropdownItem value="导出 XLSX">XLSX</DouDropdownItem>
        </DouDropdownSub>
      </DouDropdownSub>
      <DouDropdownSub title="分享给">
        <template #prefix>
          <DouIcon><ShareIcon /></DouIcon>
        </template>
        <DouDropdownItem value="分享给戴兜">戴兜</DouDropdownItem>
        <DouDropdownItem value="分享给设计组">设计组</DouDropdownItem>
      </DouDropdownSub>
      <DouDropdownItem value="移到回收站" tone="danger" divided>移到回收站</DouDropdownItem>
    </template>
  </DouDropdown>
  <DouText variant="tertiary" size="sm">最近的操作：{{ last }}</DouText>
</template>
