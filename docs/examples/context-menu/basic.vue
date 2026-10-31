<script setup>
import { CopyIcon, EditIcon, FolderOpenIcon, TrashIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const last = ref('无')
</script>

<template>
  <DouContextMenu @select="(value) => (last = value)">
    <div
      style="
        display: grid;
        place-items: center;
        height: 160px;
        border: 1px dashed var(--dou-color-border-strong);
        border-radius: var(--dou-radius-container);
        color: var(--dou-color-text-tertiary);
      "
    >
      在这里点右键或长按
    </div>
    <template #menu>
      <DouDropdownItem value="打开">
        <template #prefix>
          <DouIcon><FolderOpenIcon /></DouIcon>
        </template>
        打开
      </DouDropdownItem>
      <DouDropdownItem value="重命名">
        <template #prefix>
          <DouIcon><EditIcon /></DouIcon>
        </template>
        重命名
        <template #suffix>F2</template>
      </DouDropdownItem>
      <DouDropdownItem value="复制">
        <template #prefix>
          <DouIcon><CopyIcon /></DouIcon>
        </template>
        复制
        <template #suffix>⌘C</template>
      </DouDropdownItem>
      <DouDropdownItem value="删除" tone="danger" divided>
        <template #prefix>
          <DouIcon><TrashIcon /></DouIcon>
        </template>
        删除
      </DouDropdownItem>
    </template>
  </DouContextMenu>
  <DouText variant="tertiary" size="sm">最近的操作：{{ last }}</DouText>
</template>
