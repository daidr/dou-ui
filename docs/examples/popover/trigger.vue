<script setup>
import { ref } from 'vue'

const active = ref('dou-ui')
</script>

<template>
  <DouSpace wrap>
    <DouPopover trigger="hover" placement="right" content="指针移到卡片上，卡片不会消失。">
      <DouButton variant="outline">指向打开</DouButton>
    </DouPopover>

    <DouPopover
      trigger="hover"
      :open-on-tap="false"
      placement="bottom-start"
      title="项目状态"
      content="触屏轻点按钮直接切换项目，不会弹出预览卡片。"
    >
      <DouButton variant="outline" @click="active = active === 'dou-ui' ? 'docs' : 'dou-ui'">
        当前项目：{{ active }}
      </DouButton>
    </DouPopover>
  </DouSpace>
</template>
