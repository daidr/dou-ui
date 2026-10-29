<script setup>
import { ref } from 'vue'

const one = ref(['a'])
</script>

<template>
  <DouCollapse v-model="one" accordion bordered>
    <DouCollapseItem value="a" title="付款方式">
      默认使用尾号 4242 的信用卡。
      <template #extra>信用卡</template>
    </DouCollapseItem>
    <DouCollapseItem value="b" title="发票信息">发票抬头与税号。</DouCollapseItem>
    <DouCollapseItem value="c" title="用量提醒">超过额度 80% 时发送邮件。</DouCollapseItem>
  </DouCollapse>
</template>
