# ChatPlan 任务计划

模型开始做事前列出的步骤清单，执行过程中逐项更新状态。

## 基础用法

`items` 的每一项有 `label` 和 `status`。标题右侧显示已完成的数量，正在进行的一项带扫光效果。点击标题可以收起，也可以用 `v-model:open` 控制。

<DocDemo src="chat-plan/basic" column />

## 状态

`status` 有六种：`pending` 未开始、`running` 进行中、`waiting` 等待中、`done` 已完成、`skipped` 跳过、`error` 出错。`waiting` 表示这一步在等待用户确认或外部任务完成，与尚未开始的 `pending` 不同。`description` 在标签下方显示一行说明，比如出错的原因。

<DocDemo src="chat-plan/status" column />

## 运行开关

`running` 表示这一步是当前在做的，`live` 表示现在有没有在跑。这一轮回答结束或被用户停止后，把 `live` 设为 `false`：`running` 的步骤仍然是当前这一步，转圈换成静止的主色圆点，名字去掉扫光、保留中等字重，标题和计数不变。这样不需要把每个 `running` 的步骤逐个改成别的状态，下一轮继续时再设回 `true` 即可。

<DocDemo src="chat-plan/live" column />

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
| `live`        | 是否正在运行，为 `false` 时 `running` 的步骤静止显示               | `boolean`        | `true`     |

### ChatPlanItem

| 名称          | 说明                 | 类型                                                                    |
| ------------- | -------------------- | ----------------------------------------------------------------------- |
| `key`         | 唯一标识，默认用序号 | `string \| number`                                                      |
| `label`       | 步骤名               | `string`                                                                |
| `description` | 第二行说明           | `string`                                                                |
| `status`      | 状态，默认 `pending` | `'pending' \| 'running' \| 'waiting' \| 'done' \| 'skipped' \| 'error'` |

### Events

| 名称          | 说明         | 参数              |
| ------------- | ------------ | ----------------- |
| `update:open` | 展开状态变化 | `(open: boolean)` |

### Slots

| 名称   | 说明                                       |
| ------ | ------------------------------------------ |
| `item` | 替换每一项的文字，参数为 `{ item, index }` |
