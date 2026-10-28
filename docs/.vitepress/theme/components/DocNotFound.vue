<script setup lang="ts">
import { useRouter } from 'vitepress'

const router = useRouter()
</script>

<template>
  <div class="doc-not-found">
    <DouResult
      status="info"
      title="这个页面不存在"
      description="链接可能已经失效，或者地址拼错了。"
    >
      <template #extra>
        <DouButton variant="solid" @click="router.go('/')">回到首页</DouButton>
      </template>
    </DouResult>
  </div>
</template>
