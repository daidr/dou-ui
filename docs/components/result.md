# Result 结果

操作完成后的整页反馈，说明结果以及接下来可以做什么。

## 状态

<div class="demo" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px">
  <DouCard><DouResult status="success" title="提交成功" description="审批人会在 1 个工作日内处理。" /></DouCard>
  <DouCard><DouResult status="info" title="正在处理" description="导出完成后会通过邮件通知你。" /></DouCard>
  <DouCard><DouResult status="warning" title="部分导入失败" description="128 条记录中有 3 条格式不正确。" /></DouCard>
  <DouCard><DouResult status="danger" title="支付失败" description="银行卡余额不足，请换一张卡再试。" /></DouCard>
</div>

```vue
<DouResult status="success" title="提交成功" description="审批人会在 1 个工作日内处理。" />
```

`status` 可选 `info`（默认）、`success`、`warning`、`danger`。

## 操作与详情

默认插槽放在文字下面，通常是一个主要操作和一个次要操作；`extra` 插槽在最下面放一个浅色背景的区域，用于订单摘要、错误明细之类的内容。

<div class="demo">
  <DouResult status="warning" title="部分导入失败" description="128 条记录中有 3 条格式不正确，其余已导入。" style="width: 100%">
    <DouButton variant="solid">下载错误报告</DouButton>
    <DouButton variant="ghost">返回列表</DouButton>
    <template #extra>
      <DouText size="sm" variant="secondary">第 12 行：邮箱格式不正确<br />第 47 行：缺少手机号<br />第 98 行：部门不存在</DouText>
    </template>
  </DouResult>
</div>

```vue
<DouResult status="warning" title="部分导入失败" description="……">
  <DouButton variant="solid">下载错误报告</DouButton>
  <DouButton variant="ghost">返回列表</DouButton>
  <template #extra>……</template>
</DouResult>
```

## 读屏

`success` 和 `info` 是 `role="status"`，出现时礼貌地播报；`warning` 和 `danger` 是 `role="alert"`，立即播报。图标只是装饰（`aria-hidden`），意思由标题表达。

## API

### Result Props

| 名称          | 说明     | 类型                                           | 默认值   |
| ------------- | -------- | ---------------------------------------------- | -------- |
| `status`      | 结果类型 | `'info' \| 'success' \| 'warning' \| 'danger'` | `'info'` |
| `title`       | 标题     | `string`                                       | —        |
| `description` | 说明     | `string`                                       | —        |

### Result Slots

| 名称          | 说明           |
| ------------- | -------------- |
| `default`     | 文字下方的操作 |
| `extra`       | 最下方的详情框 |
| `icon`        | 替换图标       |
| `title`       | 替换标题       |
| `description` | 替换说明       |
