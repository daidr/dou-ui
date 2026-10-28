<script setup lang="ts">
import { useDocs } from '../use-docs'
import { ArrowLeftIcon, ArrowRightIcon } from '../icons'

const { prev, next } = useDocs()
</script>

<template>
  <nav v-if="prev || next" class="doc-pager" aria-label="上一页与下一页">
    <DouCard v-if="prev" as="a" :href="prev.link" interactive padding="sm" class="doc-pager__link">
      <span class="doc-pager__hint"
        ><DouIcon><ArrowLeftIcon /></DouIcon>上一页</span
      >
      <span class="doc-pager__title">{{ prev.text }}</span>
    </DouCard>
    <span v-else />
    <DouCard
      v-if="next"
      as="a"
      :href="next.link"
      interactive
      padding="sm"
      class="doc-pager__link doc-pager__link--next"
    >
      <span class="doc-pager__hint"
        >下一页<DouIcon><ArrowRightIcon /></DouIcon
      ></span>
      <span class="doc-pager__title">{{ next.text }}</span>
    </DouCard>
  </nav>
</template>
