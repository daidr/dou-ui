<template>
  <DouPopover title="这次发布已无法撤销" :width="260">
    <DouButton variant="outline">撤销发布</DouButton>
    <template #content="{ close }">
      <DouText as="p" variant="secondary" size="sm">
        发布超过 24 小时后不能撤销，可以重新发布一个修正版本。
      </DouText>
      <DouSpace size="sm" style="justify-content: flex-end; margin-top: 12px; width: 100%">
        <DouButton size="sm" @click="close">知道了</DouButton>
      </DouSpace>
    </template>
  </DouPopover>
</template>
