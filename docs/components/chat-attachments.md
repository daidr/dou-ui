# ChatAttachments 附件列表

消息附带的文件，可以放在输入框上方或已发送的消息里。

## 基础用法

用 `v-model` 绑定文件列表。图片在有 `url` 时显示缩略图，其他文件按类型显示图标、扩展名和大小。鼠标移到文件上时右上角出现移除按钮，移除后触发 `remove`；点击文件触发 `open`，可以用来预览。

<DocDemo src="chat-attachments/basic" />

## 上传状态

`status` 为 `running` 时底部显示进度，`percent` 是 0 到 100 的进度；`error` 时边框和说明变成危险色。上传本身由你完成，比如配合 [Upload](./upload) 的 `request` 或自己的请求代码，再更新这两个字段。

这里的状态名和聊天套件的其他组件一致，从 Upload 的文件列表转换时按下面的方式对应，`ready` 不传 `status`：

```ts
const statusOf = { uploading: 'running', success: 'done', error: 'error' } as const

const attachments = computed(() =>
  files.value.map(({ uid, name, size, type, url, status, percent }) => ({
    uid,
    name,
    size,
    type,
    url,
    percent,
    status: status === 'ready' ? undefined : statusOf[status],
  })),
)
```

<DocDemo src="chat-attachments/status" />

## 已发送的附件

放在已发送的消息里时，`removable` 设为 `false` 隐藏移除按钮。

<DocDemo src="chat-attachments/readonly" column />

## API

### Props

| 名称         | 说明                     | 类型               | 默认值 |
| ------------ | ------------------------ | ------------------ | ------ |
| `modelValue` | 文件列表，配合 `v-model` | `ChatAttachment[]` | `[]`   |
| `removable`  | 显示移除按钮             | `boolean`          | `true` |

### ChatAttachment

| 名称      | 说明                                    | 类型                             |
| --------- | --------------------------------------- | -------------------------------- |
| `uid`     | 列表内唯一                              | `string`                         |
| `name`    | 文件名                                  | `string`                         |
| `size`    | 大小，单位字节                          | `number`                         |
| `type`    | MIME 类型，用于判断图标和是否显示缩略图 | `string`                         |
| `url`     | 文件地址，图片会显示缩略图              | `string`                         |
| `status`  | 上传状态，上传完成后可以不传            | `'running' \| 'done' \| 'error'` |
| `percent` | 上传进度，0 到 100                      | `number`                         |

### Events

| 名称                | 说明       | 参数                        |
| ------------------- | ---------- | --------------------------- |
| `update:modelValue` | 列表变化   | `(files: ChatAttachment[])` |
| `remove`            | 移除了文件 | `(file: ChatAttachment)`    |
| `open`              | 点击了文件 | `(file: ChatAttachment)`    |

### Slots

| 名称   | 说明                                          |
| ------ | --------------------------------------------- |
| `item` | 替换每个文件的内容，参数为 `{ file, remove }` |
