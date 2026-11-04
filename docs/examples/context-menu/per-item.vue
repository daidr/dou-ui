<script setup>
import { ref } from 'vue'

const last = ref('无')
const files = ['设计稿.fig', '路线图.md', '发布说明.md']
const target = ref()
</script>

<template>
  <DouContextMenu
    v-model:target="target"
    @before-open="(event) => target || event.preventDefault()"
    @select="(value) => (last = `${value}「${target}」`)"
  >
    <ul
      style="
        margin: 0;
        padding: 4px;
        list-style: none;
        border: 1px solid var(--dou-color-border-subtle);
        border-radius: var(--dou-radius-container);
      "
    >
      <li
        v-for="file in files"
        :key="file"
        tabindex="0"
        style="padding: 8px 12px; border-radius: var(--dou-radius-control); cursor: default"
        @contextmenu="target = file"
      >
        {{ file }}
      </li>
    </ul>
    <template #menu>
      <DouDropdownItem value="打开">打开</DouDropdownItem>
      <DouDropdownItem value="删除" tone="danger">删除</DouDropdownItem>
    </template>
  </DouContextMenu>
  <DouText variant="tertiary" size="sm">最近的操作：{{ last }}</DouText>
</template>
