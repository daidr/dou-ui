<template>
  <DouPageHeader title="上海研发中心" subtitle="进行中" style="width: 100%">
    <template #breadcrumb>
      <DouBreadcrumb
        :items="[
          { label: '首页', href: '#' },
          { label: '项目', href: '#' },
          { label: '上海研发中心' },
        ]"
      />
    </template>
    <template #extra>
      <DouButton variant="outline" size="sm">编辑</DouButton>
      <DouButton variant="solid" size="sm">发布</DouButton>
    </template>
    园区二期的装修与搬迁，预计 12 月完成。
  </DouPageHeader>
</template>
