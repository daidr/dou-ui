# ChatQuestion 选项提问

助手向用户提一个问题，给出几个选项让用户选一个回答，比如“排哪些门店”“周会定在哪天”。

它和 [ChatConfirm](./chat-confirm) 一样，是一条等用户回答的请求，会留在对话记录里，所以有“等待中、已回答、已撤回”三种状态。只是给用户一些可以接着问的话、不需要回答时，用 [ChatSuggestions](./chat-suggestions)。

## 基础用法

`title` 是问题，`options` 是选项，每一项有 `value`、`label`，可以加 `description`、`icon` 和 `disabled`。点选一项触发 `select`，参数是这一项的 `value` 和这一项本身。各项的 `value` 不能重复。

组件不会自己改变状态。回答之后，把 `status` 设为 `answered`、`answer` 设为选中的 `value`，卡片会收起为一行，显示选中的那一项。选项文字太长时以省略号截断，鼠标悬停可以看到全文。`answer` 对应的选项不在 `options` 里时，显示“已回答”。

`answer` 属性只用来显示结果，选中时组件不会更新它，所以不能写成 `v-model:answer`。

<DocDemo src="chat-question/basic" column />

## 已撤回

用户还没回答，助手就不再需要这个回答了，比如情况变了、用户停止了生成，这时把 `status` 设为 `withdrawn`。卡片同样收起为一行，显示“已撤回”，图标和文字整体变淡，和 ChatConfirm 的撤回一致。撤回的原因写在 `description` 里。

<DocDemo src="chat-question/withdrawn" column />

## 在消息中使用

[ChatMessage](./chat-message) 的 `question` 片段渲染为这个组件，字段与 Props 相同，另外可以带一个 `id`。选中一项时，消息触发 `question` 事件，参数是这个片段、选中的 `value` 和这一项本身。

```ts
const options = [
  { value: 'sh', label: '上海门店' },
  { value: 'all', label: '全部门店' },
]
const parts = [
  { type: 'text', text: '我先确认一下范围。' },
  { type: 'question', id: 'stores', title: '排哪些门店？', options, status: 'waiting' },
]
```

## 读屏

卡片是一个以标题命名的 `group`。每个选项是一个按钮，名称是 `label`，`description` 作为它的描述读出。回答或撤回后的结果放在 `role="status"` 里，出现时会被读出；如果焦点原本在选项上，会移到卡片上，不会丢到页面最前面。

## API

### Props

| 名称          | 说明                                                                            | 类型                                     | 默认值      |
| ------------- | ------------------------------------------------------------------------------- | ---------------------------------------- | ----------- |
| `title`       | 问题                                                                            | `string`                                 | —           |
| `description` | 补充说明；撤回后可以写撤回的原因                                                | `string`                                 | —           |
| `options`     | 选项                                                                            | `ChatQuestionOption[]`                   | `[]`        |
| `status`      | 状态，`waiting` 表示等待用户回答，`answered` 表示已回答，`withdrawn` 表示已撤回 | `'waiting' \| 'answered' \| 'withdrawn'` | `'waiting'` |
| `answer`      | 选中的选项的 `value`，`answered` 时显示                                         | `string \| number`                       | —           |

### ChatQuestionOption

| 名称          | 说明                                                          | 类型               |
| ------------- | ------------------------------------------------------------- | ------------------ |
| `value`       | 选中时传给 `select`，也是 `answer` 属性要写的值；各项不能重复 | `string \| number` |
| `label`       | 选项的文字                                                    | `string`           |
| `description` | 第二行说明                                                    | `string`           |
| `icon`        | 文字前的图标组件                                              | `Component`        |
| `disabled`    | 不能选                                                        | `boolean`          |

### Events

| 名称     | 说明                                                                 | 参数                                                    |
| -------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| `select` | 点选了一项；需要自己把 `answer` 设为这个值、`status` 设为 `answered` | `(value: string \| number, option: ChatQuestionOption)` |

### Slots

| 名称     | 说明                                      |
| -------- | ----------------------------------------- |
| `icon`   | 替换图标                                  |
| `title`  | 替换标题                                  |
| `option` | 替换选项按钮里的内容，参数为 `{ option }` |
