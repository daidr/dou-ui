<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vitepress'
import { useDocs } from '../use-docs'

const router = useRouter()
const { release } = useDocs()

// Came from the development docs, through the version menu or banner: the
// page is most likely new and not released yet. Read after mount (SSR).
const fromNext = ref(false)
const nextPage = ref('')
onMounted(() => {
  fromNext.value = new URLSearchParams(window.location.search).get('from') === 'next'
  if (release.value) nextPage.value = `${release.value.sites.next}${window.location.pathname}`
})

const openNext = () => {
  window.location.href = nextPage.value
}
</script>

<template>
  <div class="doc-not-found">
    <DouResult
      status="info"
      :title="fromNext ? '正式版还没有这个页面' : '这个页面不存在'"
      :description="
        fromNext
          ? '它可能是开发版里新增、还没有发布的内容。可以先看正式版首页，或者回到开发版继续阅读。'
          : '链接可能已经失效，或者地址拼错了。'
      "
    >
      <template #extra>
        <DouSpace>
          <DouButton variant="solid" @click="router.go('/')">回到首页</DouButton>
          <DouButton v-if="fromNext && nextPage" variant="outline" @click="openNext"
            >回到开发版</DouButton
          >
        </DouSpace>
      </template>
    </DouResult>
  </div>
</template>
