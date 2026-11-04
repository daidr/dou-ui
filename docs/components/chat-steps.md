# ChatSteps 执行步骤

将模型回答前执行的操作（如搜索、读取文件、调用工具）折叠为一行摘要，展开后按时间顺序列出。

## 基础用法

`items` 是到目前为止的步骤。有步骤处于 `running` 时，摘要显示这一步的名字并带扫光效果；全部完成后摘要变为“已完成 N 个步骤”；有步骤出错或没做完时显示“共 N 个步骤”。默认收起，点击摘要展开。

每一步可以带 `icon` 和 `detail`，`detail` 用较浅的颜色显示在名字后面，适合放搜索词或文件名。

<DocDemo src="chat-steps/basic" column />

## 运行开关

`live` 表示这一轮是否还在运行，默认看是否有步骤处于 `running`。这一轮结束或被用户停止时，把 `live` 设为 `false`：摘要改为计数（“共 N 个步骤”），`running` 的步骤换成静止的圆点，不用逐个修改步骤状态。反过来，两步之间暂时没有 `running` 的步骤时，可以把 `live` 设为 `true`，摘要显示“正在处理”。含义和 [ChatPlan](./chat-plan#运行开关) 一致。

<DocDemo src="chat-steps/live" column />

## 与 ChatToolCall 的区别

[ChatToolCall](./chat-tool-call) 展示一次调用的完整参数和结果，适合需要用户核对的调用；ChatSteps 只记录做了什么，适合一连串自动完成的步骤。需要在某一步下面显示更多内容时，可以用 `detail` 插槽。

## API

### Props

| 名称    | 说明                          | 类型         | 默认值                   |
| ------- | ----------------------------- | ------------ | ------------------------ |
| `items` | 步骤                          | `ChatStep[]` | `[]`                     |
| `live`  | 是否正在运行                  | `boolean`    | 是否有步骤处于 `running` |
| `title` | 替换摘要文字                  | `string`     | —                        |
| `open`  | 是否展开，配合 `v-model:open` | `boolean`    | `false`                  |

### ChatStep

| 名称     | 说明                     | 类型                             |
| -------- | ------------------------ | -------------------------------- |
| `key`    | 唯一标识，默认用序号     | `string \| number`               |
| `label`  | 做了什么                 | `string`                         |
| `detail` | 针对什么，显示在名字后面 | `string`                         |
| `status` | 状态，默认 `done`        | `'running' \| 'done' \| 'error'` |
| `icon`   | 图标组件，不传时显示圆点 | `Component`                      |

### Events

| 名称          | 说明         | 参数              |
| ------------- | ------------ | ----------------- |
| `update:open` | 展开状态变化 | `(open: boolean)` |

### Slots

| 名称     | 说明                                       |
| -------- | ------------------------------------------ |
| `title`  | 替换摘要，参数为 `{ live, count }`         |
| `step`   | 替换每一步的文字，参数为 `{ step, index }` |
| `detail` | 每一步下方的内容，参数为 `{ step, index }` |
