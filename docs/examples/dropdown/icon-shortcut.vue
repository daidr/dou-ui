<script setup>
import { CopyIcon, EditIcon } from '@dou-ui/icons'
</script>

<template>
  <DouDropdown>
    <DouButton variant="outline">编辑</DouButton>
    <template #menu>
      <DouDropdownItem>
        <template #prefix>
          <DouIcon><CopyIcon /></DouIcon>
        </template>
        复制
        <template #suffix>⌘C</template>
      </DouDropdownItem>
      <DouDropdownItem>
        <template #prefix>
          <DouIcon><EditIcon /></DouIcon>
        </template>
        重命名
        <template #suffix>F2</template>
      </DouDropdownItem>
    </template>
  </DouDropdown>
</template>
