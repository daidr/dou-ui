<template>
  <DouResult
    status="warning"
    title="部分导入失败"
    description="128 条记录中有 3 条格式不正确，其余已导入。"
    style="width: 100%"
  >
    <DouButton variant="solid">下载错误报告</DouButton>
    <DouButton variant="ghost">返回列表</DouButton>
    <template #extra>
      <DouText size="sm" variant="secondary">
        第 12 行：邮箱格式不正确<br />第 47 行：缺少手机号<br />第 98 行：部门不存在
      </DouText>
    </template>
  </DouResult>
</template>
