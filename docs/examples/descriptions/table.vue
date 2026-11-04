<template>
  <DouDescriptions variant="table" :columns="3">
    <DouDescriptionsItem label="名称">edge-fn-sh</DouDescriptionsItem>
    <DouDescriptionsItem label="区域">上海</DouDescriptionsItem>
    <DouDescriptionsItem label="副本">3</DouDescriptionsItem>
    <DouDescriptionsItem label="说明" span="fill">
      自动扩缩容的边缘函数，部署在离用户最近的节点。
    </DouDescriptionsItem>
  </DouDescriptions>
  <DouDescriptions variant="table" layout="horizontal" :columns="2">
    <DouDescriptionsItem label="分支">main</DouDescriptionsItem>
    <DouDescriptionsItem label="提交">39dc86b</DouDescriptionsItem>
    <DouDescriptionsItem label="作者">戴兜</DouDescriptionsItem>
    <DouDescriptionsItem label="耗时">42 秒</DouDescriptionsItem>
  </DouDescriptions>
</template>
