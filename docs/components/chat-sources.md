# ChatSources 引用来源

回答所依据的网页或文档，以及正文里指向它们的角标。

## 基础用法

`ChatSources` 按顺序列出来源，序号从 1 开始。有 `url` 的来源可以点击，在新窗口打开；`site` 不传时取网址的域名。`max` 限制显示的数量，其余的收进“+N”按钮。

正文里用 `ChatCitation` 标注引用，`index` 是序号，`source` 是对应的来源。鼠标悬停或键盘聚焦时弹出来源的预览。

<DocDemo src="chat-sources/basic" column />

## 角标引用

模型的回答通常用 `[1]` 这样的标记表示引用。用 [ChatMessage](./chat-message#自定义渲染) 的 `text` 插槽把这些标记换成 `ChatCitation` 即可。

## API

### ChatSources Props

| 名称    | 说明                       | 类型           | 默认值 |
| ------- | -------------------------- | -------------- | ------ |
| `items` | 来源，按引用顺序           | `ChatSource[]` | `[]`   |
| `max`   | 最多显示几个，其余收进“+N” | `number`       | —      |

### ChatCitation Props

| 名称     | 说明                 | 类型         | 默认值 |
| -------- | -------------------- | ------------ | ------ |
| `index`  | 序号，从 1 开始      | `number`     | —      |
| `source` | 对应的来源，用于预览 | `ChatSource` | —      |

### ChatSource

| 名称          | 说明                 | 类型               |
| ------------- | -------------------- | ------------------ |
| `key`         | 唯一标识，默认用序号 | `string \| number` |
| `title`       | 标题                 | `string`           |
| `url`         | 地址                 | `string`           |
| `site`        | 站点名，默认取域名   | `string`           |
| `description` | 摘录，显示在预览里   | `string`           |
| `icon`        | 站点图标地址         | `string`           |

### ChatSources Slots

| 名称   | 说明                                           |
| ------ | ---------------------------------------------- |
| `item` | 替换每个来源的内容，参数为 `{ source, index }` |
