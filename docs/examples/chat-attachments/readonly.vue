<template>
  <DouChatBubble placement="end">
    <DouChatAttachments
      :model-value="[{ uid: '1', name: '报销单.pdf', size: 240_000 }]"
      :removable="false"
    />
    <p class="text">帮我核对一下这张报销单的金额。</p>
  </DouChatBubble>
</template>

<style scoped>
.text {
  margin: 8px 0 0;
}
</style>
