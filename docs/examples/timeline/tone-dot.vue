<script setup>
import { XCircleIcon } from '@dou-ui/icons'
</script>

<template>
  <DouTimeline>
    <DouTimelineItem time="周一" title="创建项目" tone="primary" />
    <DouTimelineItem time="周二" title="配置域名" tone="warning">
      证书签发中，可能需要几分钟。
    </DouTimelineItem>
    <DouTimelineItem time="周三" title="部署失败" tone="danger">
      <template #dot>
        <XCircleIcon />
      </template>
      构建脚本退出码 1。
    </DouTimelineItem>
  </DouTimeline>
</template>
