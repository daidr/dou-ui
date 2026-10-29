<template>
  <DouCard>
    <DouResult status="success" title="提交成功" description="审批人会在 1 个工作日内处理。" />
  </DouCard>
  <DouCard>
    <DouResult status="info" title="正在处理" description="导出完成后会通过邮件通知你。" />
  </DouCard>
  <DouCard>
    <DouResult
      status="warning"
      title="部分导入失败"
      description="128 条记录中有 3 条格式不正确。"
    />
  </DouCard>
  <DouCard>
    <DouResult status="danger" title="支付失败" description="银行卡余额不足，请换一张卡再试。" />
  </DouCard>
</template>
