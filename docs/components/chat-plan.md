# ChatPlan 任务计划

模型开始做事前列出的步骤清单，执行过程中逐项更新状态。

## 基础用法

`items` 的每一项有 `label` 和 `status`。标题右侧显示已完成的数量，正在进行的一项带扫光效果。点击标题可以收起，也可以用 `v-model:open` 控制。

<DocDemo src="chat-plan/basic" column />

## 状态

`status` 有五种：`pending` 未开始、`running` 进行中、`done` 已完成、`skipped` 跳过、`error` 出错。`description` 在标签下方显示一行说明，比如出错的原因。

<DocDemo src="chat-plan/status" column />

## 纯面板

将 `collapsible` 设为 `false` 后，标题不能点击，步骤始终展开，`open` 不再生效。适合放在侧栏或任务详情里，常驻显示当前进度。

<DocDemo src="chat-plan/panel" column />

## API

### Props

| 名称          | 说明                                                               | 类型             | 默认值     |
| ------------- | ------------------------------------------------------------------ | ---------------- | ---------- |
| `items`       | 步骤                                                               | `ChatPlanItem[]` | `[]`       |
| `title`       | 标题                                                               | `string`         | `任务计划` |
| `collapsible` | 是否可以点击标题收起，为 `false` 时始终展开                        | `boolean`        | `true`     |
| `open`        | 是否展开，配合 `v-model:open`；`collapsible` 为 `false` 时不起作用 | `boolean`        | `true`     |

### ChatPlanItem

| 名称          | 说明                 | 类型                                                       |
| ------------- | -------------------- | ---------------------------------------------------------- |
| `key`         | 唯一标识，默认用序号 | `string \| number`                                         |
| `label`       | 步骤名               | `string`                                                   |
| `description` | 第二行说明           | `string`                                                   |
| `status`      | 状态，默认 `pending` | `'pending' \| 'running' \| 'done' \| 'skipped' \| 'error'` |

### Events

| 名称          | 说明         | 参数              |
| ------------- | ------------ | ----------------- |
| `update:open` | 展开状态变化 | `(open: boolean)` |

### Slots

| 名称   | 说明                                       |
| ------ | ------------------------------------------ |
| `item` | 替换每一项的文字，参数为 `{ item, index }` |
