<script setup>
import { ArrowUpDownIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const sort = ref('activity')
const thumbnails = ref(true)
const sizes = ref(false)

const sortLabels = { activity: '上次活动', name: '名称', created: '创建日期' }
</script>

<template>
  <DouDropdown :hide-on-select="false">
    <DouButton variant="outline">
      <template #leading><ArrowUpDownIcon /></template>
      视图
    </DouButton>
    <template #menu>
      <DouDropdownRadioGroup v-model="sort" label="排序方式">
        <DouDropdownItem value="activity">上次活动</DouDropdownItem>
        <DouDropdownItem value="name">名称</DouDropdownItem>
        <DouDropdownItem value="created">创建日期</DouDropdownItem>
      </DouDropdownRadioGroup>
      <DouDropdownGroup label="显示" divided>
        <DouDropdownItem v-model:checked="thumbnails">缩略图</DouDropdownItem>
        <DouDropdownItem v-model:checked="sizes">文件大小</DouDropdownItem>
      </DouDropdownGroup>
    </template>
  </DouDropdown>
  <DouText variant="tertiary" size="sm">
    按{{ sortLabels[sort] }}排序 · 缩略图{{ thumbnails ? '开' : '关' }} · 文件大小{{
      sizes ? '开' : '关'
    }}
  </DouText>
</template>
