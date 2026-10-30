<template>
  <DouChatConfirm
    tone="danger"
    title="删除 3 个文件？"
    description="删除后无法恢复"
    approve-text="删除"
  />
  <DouChatConfirm title="发送邮件给戴兜？" status="approved" />
  <DouChatConfirm title="清空回收站？" status="denied" />
</template>
