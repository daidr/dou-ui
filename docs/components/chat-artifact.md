# ChatArtifact 产物卡片

模型生成的文档、代码、图片、网页或表格，在对话里显示为一张卡片，点击后通常在侧边面板里打开。

## 基础用法

`kind` 决定图标：`document`、`code`、`image`、`web`、`data`、`file`，需要别的图标时用 `icon` 插槽。点击卡片触发 `open`；`active` 表示这个产物正在侧边面板里显示，卡片的边框加深，并带一层浅底色。

`status` 为 `running` 时说明文字带扫光效果：传了 `description` 就显示它，适合写当前进度，比如“找报表数据从哪来 · 1/3”；没传时显示“正在生成”。完成后把 `description` 换成结果的说明。`error` 时显示生成失败。`actions` 插槽放在卡片右侧，比如下载按钮。

<DocDemo src="chat-artifact/basic" column />

完整的侧边面板用法见 [AI 对话](./chat) 里的示例。

## API

### Props

| 名称          | 说明                                                         | 类型                                                           | 默认值       |
| ------------- | ------------------------------------------------------------ | -------------------------------------------------------------- | ------------ |
| `title`       | 名称                                                         | `string`                                                       | —            |
| `kind`        | 类型，决定图标                                               | `'document' \| 'code' \| 'image' \| 'web' \| 'data' \| 'file'` | `'document'` |
| `description` | 名称下方的说明；`running` 时带扫光显示，不传时显示“正在生成” | `string`                                                       | —            |
| `status`      | 状态                                                         | `'running' \| 'done' \| 'error'`                               | `'done'`     |
| `active`      | 正在侧边面板中显示                                           | `boolean`                                                      | `false`      |

### Events

| 名称   | 说明       | 参数                  |
| ------ | ---------- | --------------------- |
| `open` | 点击了卡片 | `(event: MouseEvent)` |

### Slots

| 名称      | 说明           |
| --------- | -------------- |
| `icon`    | 替换图标       |
| `actions` | 卡片右侧的按钮 |
