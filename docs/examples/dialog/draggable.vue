<script setup>
import { ref } from 'vue'

const open = ref(false)
const fullscreen = ref(false)
</script>

<template>
  <DouButton variant="outline" @click="open = true">编辑周报</DouButton>
  <DouDialog
    v-model:open="open"
    v-model:fullscreen="fullscreen"
    title="编辑周报"
    draggable
    fullscreenable
    :width="560"
  >
    <DouSpace direction="vertical" block>
      <DouText variant="secondary"
        >拖动标题栏可以移开对话框，看看后面的内容；点右上角的按钮切换全屏。</DouText
      >
      <DouTextarea
        :rows="fullscreen ? 16 : 6"
        model-value="本周：完成活动页的交互稿，和设计确认了配色。&#10;下周：和后端联调报名接口，准备上线检查。"
      />
    </DouSpace>
    <template #footer="{ close }">
      <DouButton variant="outline" @click="close">取消</DouButton>
      <DouButton @click="close">保存</DouButton>
    </template>
  </DouDialog>
</template>
