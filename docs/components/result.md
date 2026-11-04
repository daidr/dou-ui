# Result 结果

操作完成后的整页反馈，说明结果以及接下来可以做什么。

## 状态

<DocDemo src="result/status" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px" />

`status` 可选 `info`（默认）、`success`、`warning`、`danger`。

## 操作与详情

默认插槽放在文字下面，通常是一个主要操作和一个次要操作；`extra` 插槽在最下面放一个浅色背景的区域，用于订单摘要、错误明细之类的内容。

<DocDemo src="result/action-detail" />

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

### CSS 变量

| 名称                   | 说明                             | 默认值      |
| ---------------------- | -------------------------------- | ----------- |
| `--dou-result-padding` | 内边距，放进卡片或面板时可以调小 | `48px 24px` |
