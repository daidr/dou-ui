<script setup>
import { FileTextIcon, GitPullRequestIcon, MessageIcon } from '@dou-ui/icons'
</script>

<template>
  <!-- 链接和前后的文字写在同一行：换行会变成一个空格，出现在逗号前 -->
  <!-- prettier-ignore -->
  <DouText>
    戴兜在 <DouLink href="#浅色底" variant="soft"><template #leading><GitPullRequestIcon /></template>#128 上海门店排班</DouLink> 里改了排班规则，讨论见 <DouLink href="#浅色底" variant="soft" tone="primary"><template #leading><MessageIcon /></template>周会纪要</DouLink>，整理好的说明放在 <DouLink href="#浅色底" variant="soft"><template #leading><FileTextIcon /></template>排班规则说明（第二版，含节假日与跨店支援的调整细节）</DouLink> 里，有问题直接在文档里评论。
  </DouText>
</template>
