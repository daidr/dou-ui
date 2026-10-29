# ChatConfirm 操作确认

模型执行某个操作之前请用户确认，比如运行命令、修改文件、发送邮件。

## 基础用法

`title` 说明要做什么，默认插槽放具体内容，比如要运行的命令或文件改动。点击按钮触发 `decide`，参数是 `approve`（允许）、`always`（总是允许，需要 `allow-always`）或 `deny`（拒绝）。

组件不会自己改变状态，回答之后把 `status` 设为 `approved` 或 `denied`，卡片会收起为一行结果。

<DocDemo src="chat-confirm/basic" column />

## 危险操作

`danger` 时允许按钮使用危险色，`approve-text` 和 `deny-text` 可以换成更具体的文字，比如“删除”。

<DocDemo src="chat-confirm/danger" column />

## API

### Props

| 名称          | 说明               | 类型                                  | 默认值      |
| ------------- | ------------------ | ------------------------------------- | ----------- |
| `title`       | 要确认的事         | `string`                              | —           |
| `description` | 补充说明           | `string`                              | —           |
| `status`      | 状态               | `'pending' \| 'approved' \| 'denied'` | `'pending'` |
| `allowAlways` | 显示“总是允许”按钮 | `boolean`                             | `false`     |
| `danger`      | 允许按钮使用危险色 | `boolean`                             | `false`     |
| `approveText` | 允许按钮的文字     | `string`                              | `允许`      |
| `denyText`    | 拒绝按钮的文字     | `string`                              | `拒绝`      |

### Events

| 名称     | 说明       | 参数                                          |
| -------- | ---------- | --------------------------------------------- |
| `decide` | 点击了按钮 | `(decision: 'approve' \| 'always' \| 'deny')` |

### Slots

| 名称      | 说明                 |
| --------- | -------------------- |
| `default` | 具体内容，回答后隐藏 |
| `icon`    | 替换图标             |
| `title`   | 替换标题             |
