<script setup>
import { CopyIcon, EditIcon } from '@dou-ui/icons'
</script>

<template>
  <DouDropdown>
    <DouButton variant="outline">编辑</DouButton>
    <template #menu>
      <DouDropdownItem shortcut="mod+c">
        <template #prefix>
          <DouIcon><CopyIcon /></DouIcon>
        </template>
        复制
      </DouDropdownItem>
      <DouDropdownItem shortcut="f2">
        <template #prefix>
          <DouIcon><EditIcon /></DouIcon>
        </template>
        重命名
      </DouDropdownItem>
    </template>
  </DouDropdown>
</template>
