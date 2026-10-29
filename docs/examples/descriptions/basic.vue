<template>
  <DouDescriptions title="实例">
    <template #extra>
      <DouButton variant="outline" size="sm">编辑</DouButton>
    </template>
    <DouDescriptionsItem label="名称">edge-fn-sh</DouDescriptionsItem>
    <DouDescriptionsItem label="区域">上海</DouDescriptionsItem>
    <DouDescriptionsItem label="状态">
      <DouTag tone="success" size="sm" round>运行中</DouTag>
    </DouDescriptionsItem>
    <DouDescriptionsItem label="规格">2 vCPU · 512 MB</DouDescriptionsItem>
    <DouDescriptionsItem label="创建于">2026-10-28 14:32</DouDescriptionsItem>
    <DouDescriptionsItem label="副本">3</DouDescriptionsItem>
    <DouDescriptionsItem label="说明" span="fill">
      自动扩缩容的边缘函数，部署在离用户最近的节点。
    </DouDescriptionsItem>
  </DouDescriptions>
</template>
