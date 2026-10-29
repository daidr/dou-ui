<template>
  <DouCard title="dou-ui.dev" description="最近一次部署于 3 分钟前完成，所有检查均已通过。">
    <template #extra>
      <DouTag tone="success" round>运行中</DouTag>
    </template>
    <DouText variant="secondary" size="sm" mono>main · 39dc86b</DouText>
    <template #footer>
      <DouButton variant="ghost" size="sm">日志</DouButton>
      <DouButton variant="outline" size="sm">回滚</DouButton>
      <DouButton size="sm">访问</DouButton>
    </template>
  </DouCard>
</template>
