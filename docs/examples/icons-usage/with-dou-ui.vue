<script setup>
import { DownloadIcon, LoaderIcon, PlusIcon, SearchIcon } from '@dou-ui/icons'
</script>

<template>
  <DouButton>
    <template #leading>
      <DouIcon><PlusIcon /></DouIcon>
    </template>
    新建
  </DouButton>
  <DouButton variant="outline">
    <template #leading>
      <DouIcon><DownloadIcon /></DouIcon>
    </template>
    下载
  </DouButton>
  <DouInput placeholder="搜索" style="width: 200px">
    <template #prefix>
      <DouIcon><SearchIcon /></DouIcon>
    </template>
  </DouInput>
  <DouIcon spin :size="18"><LoaderIcon /></DouIcon>
</template>
