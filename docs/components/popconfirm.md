# Popconfirm 气泡确认

在按钮旁边问一句“确定吗？”，适合删除、撤销这类一步就能完成、但做了需要先想一下的操作。它建在 Popover 上：问题前面一个带语气色的图标，下面两个小按钮；只有图标带颜色，`tone="danger"` 时确认按钮也变成危险色。

## 基础用法

<DocDemo src="popconfirm/basic" />

默认插槽是触发元素，点击打开。打开后焦点落在“取消”上：直接按 `Enter` 得到的是安全的那个答案。

## 危险操作与异步确认

`tone="danger"` 用于无法撤销的操作。`@confirm` 的处理函数可以返回 Promise：等待期间确认按钮显示加载状态，成功后关闭；失败（Promise 被拒绝）时保持打开，可以再试一次。

<DocDemo src="popconfirm/async-confirm" />

## 语气

`tone` 可选 `warning`（默认）、`danger` 和 `neutral`，只影响图标的颜色，以及 `danger` 时的确认按钮。`icon` 插槽可以换掉图标。

## 只需告知时

Popconfirm 总是在问“要不要继续”，所以始终有取消和确认两个按钮，不能隐藏取消。如果只是告诉用户一件事，例如点击“撤销”后才发现这次已经不能撤销，请改用 [Popover](./popover)，在 `content` 插槽里放一个“知道了”按钮：

<DocDemo src="popconfirm/notice" />

需要打断用户、等用户看完再继续的提示，使用 [`dialog.alert()`](./dialog#函数式调用)；操作完成后才需要告知的结果，使用 [Toast](./toast)。

## 键盘与读屏

浮层是 `role="alertdialog"`，以问题作为名称。`Esc` 或点击外部关闭（等同于取消，但不触发 `cancel` 事件），焦点回到触发元素；`Tab` 在两个按钮之间移动，沿用 Popover 的约定。

## API

### Popconfirm Props

| 名称          | 说明                                    | 类型                                 | 默认值      |
| ------------- | --------------------------------------- | ------------------------------------ | ----------- |
| `open`        | 是否打开，配合 `v-model:open`           | `boolean`                            | `false`     |
| `title`       | 问题                                    | `string`                             | —           |
| `description` | 补充说明                                | `string`                             | —           |
| `tone`        | 图标颜色；`danger` 时确认按钮也是危险色 | `'neutral' \| 'warning' \| 'danger'` | `'warning'` |
| `confirmText` | 确认按钮的文字                          | `string`                             | 语言包      |
| `cancelText`  | 取消按钮的文字                          | `string`                             | 语言包      |
| `placement`   | 弹出的位置                              | `Placement`                          | `'top'`     |
| `width`       | 浮层宽度，数字为 px                     | `string \| number`                   | —           |
| `disabled`    | 禁用                                    | `boolean`                            | `false`     |
| `teleport`    | 渲染到哪里，`false` 留在原处            | `string \| HTMLElement \| false`     | `'body'`    |

### Popconfirm Events

| 名称          | 说明                                                    | 参数               |
| ------------- | ------------------------------------------------------- | ------------------ |
| `confirm`     | 点击确认；返回 Promise 时等它完成再关闭，被拒绝则不关闭 | —                  |
| `cancel`      | 点击取消                                                | —                  |
| `update:open` | 打开或关闭                                              | `(value: boolean)` |

### Popconfirm Slots

| 名称          | 说明         |
| ------------- | ------------ |
| `default`     | 触发元素     |
| `icon`        | 替换图标     |
| `title`       | 替换问题     |
| `description` | 替换补充说明 |
