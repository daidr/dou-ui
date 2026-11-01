<script setup>
import { DouSheet, DouSheetTabs, DouSheetToolbar } from '@dou-ui/sheet'
import { ref } from 'vue'

const book = ref({
  version: 1,
  sheets: [
    {
      name: '门店',
      colSizes: { 0: 120, 1: 140 },
      cells: [
        ['门店', '开业日期', '面积'],
        ['上海静安', { value: '2021-04-18', format: 'yyyy年m月d日' }, 128],
        ['上海徐汇', { value: '2023-09-02', format: 'yyyy年m月d日' }, 96],
      ],
    },
  ],
})
</script>

<template>
  <!-- 工具栏的导入按钮读入 CSV，导出菜单下载 CSV 或图片；也可以把 CSV 文件拖到表格上 -->
  <DouSheet v-model="book" file-drop style="height: 260px">
    <template #header>
      <DouSheetToolbar :tools="['undo', 'redo', '|', 'bold', 'italic', '|', 'import', 'export']" />
    </template>
    <template #footer>
      <DouSheetTabs />
    </template>
  </DouSheet>
</template>
