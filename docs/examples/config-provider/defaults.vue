<template>
  <DouConfigProvider :defaults="{ DouButton: { variant: 'outline', tone: 'primary' } }">
    <DouSpace>
      <DouButton>保存草稿</DouButton>
      <DouButton>预览</DouButton>
      <DouButton variant="solid">发布</DouButton>
    </DouSpace>
  </DouConfigProvider>
</template>
